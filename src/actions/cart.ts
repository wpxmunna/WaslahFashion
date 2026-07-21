"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getOrCreateCart, resolveCart } from "@/lib/cart";
import { effectivePrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type CartActionResult = {
  ok: boolean;
  message: string;
  cartCount?: number;
};

const addSchema = z.object({
  productId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

async function countItems(cartId: number): Promise<number> {
  const result = await prisma.cartItem.aggregate({
    where: { cartId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/**
 * Confirm a cart item belongs to the caller's cart.
 *
 * The legacy endpoints accepted any `item_id` and mutated it without checking
 * ownership, so anyone could edit or delete strangers' cart lines (IDOR).
 */
async function assertOwnedItem(itemId: number) {
  const cart = await resolveCart();
  if (!cart) return null;

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId: cart.id },
    select: { id: true, cartId: true, productId: true, variantId: true },
  });

  return item;
}

export async function addToCart(formData: FormData): Promise<CartActionResult> {
  const parsed = addSchema.safeParse({
    productId: formData.get("productId"),
    variantId: formData.get("variantId") || undefined,
    quantity: formData.get("quantity") ?? 1,
  });

  if (!parsed.success) return { ok: false, message: "That request wasn't valid." };
  const { productId, variantId, quantity } = parsed.data;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, status: true, price: true, salePrice: true, stockQuantity: true },
  });

  if (!product || product.status !== "ACTIVE") {
    return { ok: false, message: "This product is no longer available." };
  }

  let unitPrice = effectivePrice(product.price, product.salePrice);
  let availableStock = product.stockQuantity;

  if (variantId) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
      select: { id: true, priceModifier: true, stockQuantity: true, isActive: true },
    });

    // Legacy left `$variant` unset here and fell through to a confusing
    // "out of stock" message; say what actually happened.
    if (!variant || !variant.isActive) {
      return { ok: false, message: "That size or colour isn't available." };
    }

    unitPrice += toNumber(variant.priceModifier);
    availableStock = variant.stockQuantity;
  }

  if (availableStock <= 0) {
    return { ok: false, message: "This item is out of stock." };
  }

  const cart = await getOrCreateCart();

  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId, variantId: variantId ?? null },
    select: { id: true, quantity: true },
  });

  const desired = (existing?.quantity ?? 0) + quantity;
  if (desired > availableStock) {
    return {
      ok: false,
      message:
        existing
          ? `You already have ${existing.quantity} in your bag — only ${availableStock} in stock.`
          : `Only ${availableStock} left in stock.`,
    };
  }

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: desired, unitPrice },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, variantId: variantId ?? null, quantity, unitPrice },
    });
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: `${product.name} added to your bag.`,
    cartCount: await countItems(cart.id),
  };
}

export async function updateCartItem(itemId: number, quantity: number): Promise<CartActionResult> {
  const item = await assertOwnedItem(itemId);
  if (!item) return { ok: false, message: "That item isn't in your bag." };

  // Quantity 0 or below removes the line, matching the legacy behaviour.
  if (quantity <= 0) return removeCartItem(itemId);

  const stock = item.variantId
    ? (
        await prisma.productVariant.findUnique({
          where: { id: item.variantId },
          select: { stockQuantity: true },
        })
      )?.stockQuantity ?? 0
    : (
        await prisma.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true },
        })
      )?.stockQuantity ?? 0;

  // Legacy never validated stock on update — it only failed at checkout.
  if (quantity > stock) {
    return { ok: false, message: `Only ${stock} left in stock.` };
  }

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity: Math.min(quantity, 99) },
  });

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { ok: true, message: "Bag updated.", cartCount: await countItems(item.cartId) };
}

export async function removeCartItem(itemId: number): Promise<CartActionResult> {
  const item = await assertOwnedItem(itemId);
  if (!item) return { ok: false, message: "That item isn't in your bag." };

  await prisma.cartItem.delete({ where: { id: item.id } });

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { ok: true, message: "Removed from your bag.", cartCount: await countItems(item.cartId) };
}

export async function clearCart(): Promise<CartActionResult> {
  const cart = await resolveCart();
  if (!cart) return { ok: true, message: "Your bag is already empty.", cartCount: 0 };

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { ok: true, message: "Bag cleared.", cartCount: 0 };
}
