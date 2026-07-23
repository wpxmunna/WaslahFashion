import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import { Prisma } from "@/generated/prisma";
import { DEFAULT_SHIPPING_COST, DEFAULT_STORE_ID, FREE_SHIPPING_THRESHOLD, TAX_RATE } from "./config";
import { effectivePrice, toNumber } from "./money";
import { imageUrl } from "./images";
import { getSession } from "./auth";
import { getShippingSettings } from "./settings";
import { prisma } from "./prisma";

const CART_COOKIE = "waslah_cart";
const CART_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Guest carts are keyed by a dedicated cookie token rather than the session id.
 *
 * The legacy app keyed them by PHP's `session_id()`, then called
 * `session_regenerate_id()` during login *before* merging — so the merge looked
 * up the new id, found nothing, and silently dropped every guest cart on login.
 */
const cartItemSelect = {
  id: true,
  quantity: true,
  productId: true,
  variantId: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      salePrice: true,
      sku: true,
      status: true,
      stockQuantity: true,
      images: {
        select: { path: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
  },
  variant: {
    select: {
      id: true,
      size: true,
      colorName: true,
      priceModifier: true,
      stockQuantity: true,
      isActive: true,
    },
  },
} satisfies Prisma.CartItemSelect;

export type CartLine = {
  id: number;
  productId: number;
  variantId: number | null;
  name: string;
  slug: string;
  sku: string | null;
  image: string | null;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableStock: number;
  /** True when the line exceeds available stock or the product went inactive. */
  hasIssue: boolean;
  issue: string | null;
};

export type CartTotals = {
  itemCount: number;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
};

export type CartView = {
  cartId: number | null;
  lines: CartLine[];
  totals: CartTotals;
};

/** `"M / Black"`, `"M"`, `"Black"`, or null — mirrors legacy `variant_info`. */
export function variantLabel(size?: string | null, color?: string | null): string | null {
  const parts = [size, color].filter((p): p is string => !!p && p.trim() !== "");
  return parts.length ? parts.join(" / ") : null;
}

async function readCartToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(CART_COOKIE)?.value ?? null;
}

/**
 * Find the current cart without creating one or touching cookies. Safe to call
 * from Server Components.
 */
export const resolveCart = cache(async () => {
  const session = await getSession();

  if (session) {
    return prisma.cart.findFirst({
      where: { userId: session.userId, storeId: DEFAULT_STORE_ID },
      orderBy: { id: "desc" },
    });
  }

  const token = await readCartToken();
  if (!token) return null;

  return prisma.cart.findUnique({ where: { token } });
});

/**
 * Find or create the current cart, issuing a guest cookie when needed.
 * Only callable from a Server Action or Route Handler (it may set a cookie).
 */
export async function getOrCreateCart() {
  const session = await getSession();

  if (session) {
    const existing = await prisma.cart.findFirst({
      where: { userId: session.userId, storeId: DEFAULT_STORE_ID },
      orderBy: { id: "desc" },
    });
    if (existing) return existing;

    return prisma.cart.create({
      data: { userId: session.userId, storeId: DEFAULT_STORE_ID },
    });
  }

  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;

  if (token) {
    const existing = await prisma.cart.findUnique({ where: { token } });
    if (existing) return existing;
  }

  const newToken = randomBytes(24).toString("hex");
  const cart = await prisma.cart.create({
    data: { token: newToken, storeId: DEFAULT_STORE_ID },
  });

  jar.set(CART_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_MAX_AGE,
  });

  return cart;
}

export function computeTotals(
  lines: CartLine[],
  settings?: {
    freeShippingThreshold: number;
    defaultShippingCost: number;
    taxRate: number;
  },
): CartTotals {
  const freeThreshold = settings?.freeShippingThreshold ?? FREE_SHIPPING_THRESHOLD;
  const flatRate = settings?.defaultShippingCost ?? DEFAULT_SHIPPING_COST;
  const taxRate = settings?.taxRate ?? TAX_RATE;

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);

  // Legacy charged the flat 80 BDT even on an empty cart; an empty cart now
  // costs nothing. Shipping is assessed on the pre-discount subtotal.
  const shipping = itemCount === 0 || subtotal >= freeThreshold ? 0 : flatRate;
  const tax = round2(subtotal * taxRate);

  return {
    itemCount,
    subtotal: round2(subtotal),
    shipping,
    tax,
    total: round2(subtotal + shipping + tax),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Full cart contents with live pricing and per-line stock validation. */
export async function getCartView(): Promise<CartView> {
  const [cart, shipping] = await Promise.all([resolveCart(), getShippingSettings()]);

  if (!cart) {
    return { cartId: null, lines: [], totals: computeTotals([], shipping) };
  }

  const items = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    select: cartItemSelect,
    orderBy: { createdAt: "desc" },
  });

  const lines: CartLine[] = items.map((item) => {
    // Totals recompute from the live product price rather than the stored
    // snapshot, matching legacy behaviour.
    const base = effectivePrice(item.product.price, item.product.salePrice);
    const unitPrice = round2(base + toNumber(item.variant?.priceModifier));
    const availableStock = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;

    let issue: string | null = null;
    if (item.product.status !== "ACTIVE") issue = "No longer available";
    else if (item.variant && !item.variant.isActive) issue = "This option is no longer available";
    else if (availableStock <= 0) issue = "Out of stock";
    else if (item.quantity > availableStock) issue = `Only ${availableStock} left in stock`;

    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.product.name,
      slug: item.product.slug,
      sku: item.product.sku,
      image: imageUrl(item.product.images[0]?.path),
      variantLabel: variantLabel(item.variant?.size, item.variant?.colorName),
      quantity: item.quantity,
      unitPrice,
      lineTotal: round2(unitPrice * item.quantity),
      availableStock,
      hasIssue: issue !== null,
      issue,
    };
  });

  return { cartId: cart.id, lines, totals: computeTotals(lines, shipping) };
}

/**
 * Item count for the header badge. Legacy read an unused session array for
 * guests, so the guest badge always rendered 0.
 */
export async function getCartCount(): Promise<number> {
  const cart = await resolveCart();
  if (!cart) return 0;

  const result = await prisma.cartItem.aggregate({
    where: { cartId: cart.id },
    _sum: { quantity: true },
  });

  return result._sum.quantity ?? 0;
}

/**
 * Fold a guest cart into the user's cart at login/registration, summing
 * quantities for lines that exist in both (capped at available stock).
 */
export async function mergeGuestCartIntoUser(userId: number): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return;

  const guestCart = await prisma.cart.findUnique({
    where: { token },
    include: { items: true },
  });

  // Nothing to merge, or the cookie already points at a claimed cart.
  if (!guestCart || guestCart.userId !== null) {
    jar.delete(CART_COOKIE);
    return;
  }

  if (guestCart.items.length === 0) {
    await prisma.cart.delete({ where: { id: guestCart.id } });
    jar.delete(CART_COOKIE);
    return;
  }

  const userCart =
    (await prisma.cart.findFirst({
      where: { userId, storeId: DEFAULT_STORE_ID },
      orderBy: { id: "desc" },
    })) ?? null;

  // No existing cart: just claim the guest cart wholesale.
  if (!userCart) {
    await prisma.cart.update({
      where: { id: guestCart.id },
      data: { userId, token: null },
    });
    jar.delete(CART_COOKIE);
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const item of guestCart.items) {
      const existing = await tx.cartItem.findFirst({
        where: {
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
        },
      });

      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + item.quantity },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: userCart.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          },
        });
      }
    }

    await tx.cart.delete({ where: { id: guestCart.id } });
  });

  jar.delete(CART_COOKIE);
}
