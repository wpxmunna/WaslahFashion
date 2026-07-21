import "server-only";

import type { Coupon } from "@/generated/prisma";
import type { CartLine } from "./cart";
import { DEFAULT_STORE_ID } from "./config";
import { formatPrice, toNumber } from "./money";
import { prisma } from "./prisma";

export type CouponEvaluation =
  | { valid: false; message: string }
  | {
      valid: true;
      coupon: Coupon;
      /** Money off the subtotal. Zero for free-shipping and gift coupons. */
      discount: number;
      freeShipping: boolean;
      giftProduct: { id: number; name: string; price: number; image: string | null } | null;
      message: string;
    };

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Discount for a coupon against a cart.
 *
 * `buy_x_get_y` was declared in the legacy enum and "handled separately in
 * cart/checkout" — but it never was, so those coupons silently granted
 * nothing. Implemented here as: across all units in the cart, every
 * (buy + get) units earns `get` free, applied to the cheapest units.
 */
export function calculateDiscount(
  coupon: Coupon,
  lines: CartLine[],
  subtotal: number,
  shipping: number,
): number {
  const value = toNumber(coupon.value);

  switch (coupon.type) {
    case "PERCENTAGE": {
      const raw = (subtotal * value) / 100;
      const cap = coupon.maximumDiscount ? toNumber(coupon.maximumDiscount) : Infinity;
      return round2(Math.min(raw, cap, subtotal));
    }

    case "FIXED":
      return round2(Math.min(value, subtotal));

    case "FREE_SHIPPING":
      return round2(shipping);

    case "GIFT_ITEM":
      return 0;

    case "BUY_X_GET_Y": {
      const buy = coupon.buyQuantity ?? 0;
      const get = coupon.getQuantity ?? 0;
      if (buy <= 0 || get <= 0) return 0;

      // Expand to individual unit prices, cheapest first.
      const units = lines
        .flatMap((line) => Array<number>(line.quantity).fill(line.unitPrice))
        .sort((a, b) => a - b);

      const sets = Math.floor(units.length / (buy + get));
      const freeUnits = Math.min(sets * get, units.length);

      const discount = units.slice(0, freeUnits).reduce((sum, price) => sum + price, 0);
      return round2(Math.min(discount, subtotal));
    }

    default:
      return 0;
  }
}

/**
 * Validate a coupon code against the server's own view of the cart.
 *
 * Always re-run this at order placement — the client can post any subtotal it
 * likes to the "apply coupon" endpoint.
 */
export async function evaluateCoupon(
  code: string,
  lines: CartLine[],
  subtotal: number,
  shipping: number,
  storeId = DEFAULT_STORE_ID,
): Promise<CouponEvaluation> {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return { valid: false, message: "Enter a coupon code." };

  const coupon = await prisma.coupon.findFirst({
    where: { code: normalised, storeId, isActive: true },
  });

  if (!coupon) return { valid: false, message: "That coupon code isn't valid." };

  const now = new Date();
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { valid: false, message: "This coupon has expired." };
  }
  if (coupon.startsAt && coupon.startsAt > now) {
    return { valid: false, message: "This coupon isn't active yet." };
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: "This coupon has reached its usage limit." };
  }

  const minimum = toNumber(coupon.minimumAmount);
  if (minimum > 0 && subtotal < minimum) {
    return {
      valid: false,
      message: `Spend ${formatPrice(minimum)} to use this coupon.`,
    };
  }

  let gift: { id: number; name: string; price: number; image: string | null } | null = null;

  if (coupon.type === "GIFT_ITEM" && coupon.giftProductId) {
    const product = await prisma.product.findUnique({
      where: { id: coupon.giftProductId },
      select: {
        id: true,
        name: true,
        price: true,
        salePrice: true,
        images: {
          select: { path: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
        },
      },
    });

    if (product) {
      gift = {
        id: product.id,
        name: product.name,
        price: toNumber(product.salePrice ?? product.price),
        image: product.images[0]?.path ?? null,
      };
    }
  }

  const discount = calculateDiscount(coupon, lines, subtotal, shipping);

  const message =
    coupon.type === "FREE_SHIPPING"
      ? "Free delivery applied."
      : coupon.type === "GIFT_ITEM"
        ? gift
          ? `${gift.name} will be added free to your order.`
          : "Gift will be added to your order."
        : coupon.type === "BUY_X_GET_Y"
          ? `Buy ${coupon.buyQuantity} get ${coupon.getQuantity} free applied.`
          : `Coupon applied — ${formatPrice(discount)} off.`;

  return {
    valid: true,
    coupon,
    discount,
    freeShipping: coupon.type === "FREE_SHIPPING",
    giftProduct: gift,
    message,
  };
}
