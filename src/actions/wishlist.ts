"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type WishlistResult = {
  ok: boolean;
  message: string;
  /** Signals the client to send the visitor to sign-in. */
  requiresAuth?: boolean;
  added?: boolean;
};

/** Add or remove in one call, mirroring the legacy toggle endpoint. */
export async function toggleWishlist(productId: number): Promise<WishlistResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, requiresAuth: true, message: "Sign in to save pieces." };
  }

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: session.userId, productId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/account/wishlist");
    return { ok: true, added: false, message: "Removed from your wishlist." };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return { ok: false, message: "That product no longer exists." };

  await prisma.wishlistItem.create({ data: { userId: session.userId, productId } });
  revalidatePath("/account/wishlist");
  return { ok: true, added: true, message: "Saved to your wishlist." };
}
