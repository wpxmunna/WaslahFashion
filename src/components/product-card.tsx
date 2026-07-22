import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SafeImage } from "@/components/safe-image";
import { WishlistButton } from "@/components/wishlist-button";

import type { ProductCard as ProductCardData } from "@/lib/queries/products";
import { discountPercent, effectivePrice, formatPrice, isOnSale, toNumber } from "@/lib/money";
import { imageUrl, placeholderTone } from "@/lib/images";
import { cn } from "@/lib/utils";

type Props = {
  product: ProductCardData;
  /** Index within a grid, used to stagger the entrance animation. */
  index?: number;
  className?: string;
};

export function ProductCard({ product, index = 0, className }: Props) {
  const primary = imageUrl(product.images[0]?.path);
  const secondary = imageUrl(product.images[1]?.path);
  const price = effectivePrice(product.price, product.salePrice);
  const onSale = isOnSale(product.price, product.salePrice);
  const off = discountPercent(product.price, product.salePrice);
  const soldOut = product.stockQuantity <= 0;
  const href = `/product/${product.slug}`;

  return (
    <article
      className={cn("group animate-rise", className)}
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
    >
      <div
        className="relative aspect-[3/4] overflow-hidden bg-muted"
        style={{ backgroundColor: placeholderTone(product.slug) }}
      >
        {primary ? (
          <>
            <SafeImage
              src={primary}
              alt={product.images[0]?.altText ?? product.name}
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
              className={cn(
                "object-cover transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                secondary ? "group-hover:opacity-0" : "group-hover:scale-[1.05]",
              )}
            />
            {secondary && (
              <SafeImage
                src={secondary}
                alt=""
                aria-hidden
                fill
                sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
                className="object-cover opacity-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05] group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-5xl font-bold text-foreground/10">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Badges — top-left, stacked, never overlapping. */}
        <div className="absolute left-0 top-3 z-20 flex flex-col items-start gap-1.5">
          {onSale && !soldOut && (
            <span className="kicker bg-accent px-2.5 py-1 text-accent-foreground">
              −{off}%
            </span>
          )}
          {soldOut && (
            <span className="kicker bg-foreground/90 px-2.5 py-1 text-background">
              Sold out
            </span>
          )}
        </div>

        {/* Whole-media click target, beneath the wishlist control. */}
        <Link href={href} aria-label={product.name} className="absolute inset-0 z-10" />

        {/* Wishlist — revealed on hover (desktop), always shown on touch. */}
        <WishlistButton
          productId={product.id}
          className={cn(
            "absolute right-3 top-3 z-20 shadow-sm transition-all duration-300",
            "sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100",
          )}
        />

        {/* Sliding "view" bar — visual only; the media link handles the click. */}
        {!soldOut && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] translate-y-full bg-foreground/92 px-4 py-3 text-background transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0">
            <span className="flex items-center justify-between text-[0.8125rem] font-semibold uppercase tracking-[0.1em]">
              View product
              <ArrowUpRight className="size-4" strokeWidth={2} />
            </span>
          </div>
        )}
      </div>

      <div className="pt-3.5">
        {product.category && (
          <p className="kicker text-muted-foreground">{product.category.name}</p>
        )}
        <h3 className="mt-1.5 font-display text-[1.05rem] font-semibold leading-snug tracking-tight">
          <Link href={href} className="link-wipe">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-baseline gap-2">
          <span className="font-display text-[0.95rem] font-bold tabular-nums">
            {formatPrice(price)}
          </span>
          {onSale && (
            <span className="text-xs text-muted-foreground line-through tabular-nums">
              {formatPrice(toNumber(product.price))}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}
