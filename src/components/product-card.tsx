import Link from "next/link";
import { SafeImage } from "@/components/safe-image";

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

  return (
    <Link
      href={`/product/${product.slug}`}
      className={cn("group animate-rise block", className)}
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
                secondary
                  ? "group-hover:opacity-0"
                  : "group-hover:scale-[1.04]",
              )}
            />
            {secondary && (
              <SafeImage
                src={secondary}
                alt=""
                aria-hidden
                fill
                sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
                className="object-cover opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-4xl text-foreground/15">
              {product.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Badges sit on the image, never overlapping each other. */}
        <div className="absolute left-0 top-3 flex flex-col items-start gap-1.5">
          {onSale && !soldOut && (
            <span className="kicker bg-accent px-2.5 py-1 text-accent-foreground">
              {off}% off
            </span>
          )}
          {soldOut && (
            <span className="kicker bg-foreground/85 px-2.5 py-1 text-background">
              Sold out
            </span>
          )}
        </div>
      </div>

      <div className="pt-3.5">
        {product.category && (
          <p className="kicker text-muted-foreground">{product.category.name}</p>
        )}
        <h3 className="mt-1 font-display text-[1.0625rem] leading-snug">
          <span className="link-wipe">{product.name}</span>
        </h3>
        <p className="mt-1.5 flex items-baseline gap-2 text-sm">
          <span className={cn("tabular-nums", onSale && "text-accent-foreground")}>
            {formatPrice(price)}
          </span>
          {onSale && (
            <span className="text-xs text-muted-foreground line-through tabular-nums">
              {formatPrice(toNumber(product.price))}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
