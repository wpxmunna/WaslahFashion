import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, RotateCcw, ShieldCheck, Truck } from "lucide-react";

import { ProductCard } from "@/components/product-card";
import { ProductGallery, type GalleryImage } from "@/components/product-gallery";
import { ProductPurchase, type PurchaseVariant } from "@/components/product-purchase";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WishlistButton } from "@/components/wishlist-button";
import { SizeGuide } from "@/components/size-guide";
import { coerceSizeChart } from "@/lib/size-chart";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShippingSettings } from "@/lib/settings";
import { imageUrl } from "@/lib/images";
import { discountPercent, effectivePrice, formatPrice, isOnSale, toNumber } from "@/lib/money";
import {
  getProductBySlug,
  getRelatedProducts,
  incrementProductViews,
} from "@/lib/queries/products";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const description =
    product.metaDescription ??
    product.shortDescription ??
    product.description?.slice(0, 160) ??
    undefined;

  return {
    title: product.metaTitle ?? product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.images[0] ? [imageUrl(product.images[0].path)!] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Analytics only — never block the render on it.
  void incrementProductViews(product.id);

  const session = await getSession();
  const shippingSettings = await getShippingSettings();
  const [related, savedRow] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId, 4),
    session
      ? prisma.wishlistItem.findUnique({
          where: { userId_productId: { userId: session.userId, productId: product.id } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  const price = effectivePrice(product.price, product.salePrice);
  const onSale = isOnSale(product.price, product.salePrice);
  const sizeChart = coerceSizeChart(product.sizeChart?.data ?? null);

  const images: GalleryImage[] = product.images
    .map((img) => ({ id: img.id, src: imageUrl(img.path)!, alt: img.altText ?? product.name }))
    .filter((i) => !!i.src);

  const variants: PurchaseVariant[] = product.variants.map((v) => ({
    id: v.id,
    size: v.size,
    colorName: v.colorName ?? v.color?.name ?? null,
    colorHex: v.colorHex ?? v.color?.hex ?? null,
    priceModifier: toNumber(v.priceModifier),
    stockQuantity: v.stockQuantity,
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-14">
      <nav aria-label="Breadcrumb" className="mb-8">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <li>
            <Link href="/" className="link-wipe">
              Home
            </Link>
          </li>
          <ChevronRight className="size-3" strokeWidth={1.5} />
          <li>
            <Link href="/shop" className="link-wipe">
              Shop
            </Link>
          </li>
          {product.category && (
            <>
              <ChevronRight className="size-3" strokeWidth={1.5} />
              <li>
                <Link href={`/shop/category/${product.category.slug}`} className="link-wipe">
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
          <ChevronRight className="size-3" strokeWidth={1.5} />
          <li className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <ProductGallery images={images} name={product.name} />

        <div className="lg:sticky lg:top-32 lg:self-start">
          {product.category && (
            <p className="kicker text-muted-foreground">{product.category.name}</p>
          )}

          <h1 className="mt-2 font-display text-[clamp(2rem,3.8vw,2.9rem)] font-bold leading-[1.05] tracking-tight">
            {product.name}
          </h1>

          {onSale && (
            <p className="mt-3 flex items-center gap-3 text-sm">
              <span className="kicker bg-accent px-2 py-1 text-accent-foreground">
                {discountPercent(product.price, product.salePrice)}% off
              </span>
              <span className="text-muted-foreground line-through tabular-nums">
                {formatPrice(toNumber(product.price))}
              </span>
            </p>
          )}

          {product.shortDescription && (
            <p className="mt-5 text-[0.95rem] leading-relaxed text-muted-foreground">
              {product.shortDescription}
            </p>
          )}

          <div className="mt-8">
            <ProductPurchase
              productId={product.id}
              basePrice={price}
              productStock={product.stockQuantity}
              variants={variants}
            />
            <div className="mt-3">
              <WishlistButton
                productId={product.id}
                initialSaved={!!savedRow}
                variant="full"
                className="w-full"
              />
            </div>

            {sizeChart && (
              <div className="mt-3">
                <SizeGuide chart={sizeChart} />
              </div>
            )}
          </div>

          <ul className="mt-8 space-y-3 border-t border-border pt-6 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <Truck className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
              Free delivery over {formatPrice(shippingSettings.freeShippingThreshold)}, nationwide.
            </li>
            <li className="flex items-start gap-3">
              <RotateCcw className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
              Exchanges and returns within 7 days.
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
              Cash on delivery available.
            </li>
          </ul>

          <Accordion multiple={false} className="mt-8 border-t border-border">
            {product.description && (
              <AccordionItem value="description">
                <AccordionTrigger className="kicker">Description</AccordionTrigger>
                <AccordionContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}

            {product.material && (
              <AccordionItem value="material">
                <AccordionTrigger className="kicker">Material &amp; care</AccordionTrigger>
                <AccordionContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {product.material}
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="details">
              <AccordionTrigger className="kicker">Details</AccordionTrigger>
              <AccordionContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  {product.sku && (
                    <>
                      <dt className="text-muted-foreground">SKU</dt>
                      <dd className="tabular-nums">{product.sku}</dd>
                    </>
                  )}
                  {product.category && (
                    <>
                      <dt className="text-muted-foreground">Category</dt>
                      <dd>{product.category.name}</dd>
                    </>
                  )}
                  {product.weight && (
                    <>
                      <dt className="text-muted-foreground">Weight</dt>
                      <dd className="tabular-nums">{toNumber(product.weight)} kg</dd>
                    </>
                  )}
                </dl>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24 lg:mt-32">
          <div className="rule-fade" />
          <h2 className="display-title mt-10 text-[clamp(1.8rem,3.5vw,2.75rem)]">
            You may also like
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {related.map((item, i) => (
              <ProductCard key={item.id} product={item} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
