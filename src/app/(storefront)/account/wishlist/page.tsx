import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/product-card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productCardSelect } from "@/lib/queries/products";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const saved = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, product: { select: productCardSelect } },
  });

  if (saved.length === 0) {
    return (
      <div className="border border-dashed border-border p-12 text-center">
        <p className="font-display text-2xl">Nothing saved yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Save pieces you like and they&apos;ll be waiting here.
        </p>
        <Link href="/shop" className="link-wipe kicker mt-5 inline-block">
          Browse the collection
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl">Saved pieces</h2>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
        {saved.map((item, i) => (
          <ProductCard key={item.id} product={item.product} index={i} />
        ))}
      </div>
    </div>
  );
}
