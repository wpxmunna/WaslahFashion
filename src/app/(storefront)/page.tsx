import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SafeImage } from "@/components/safe-image";

import { HeroCarousel, type HeroSlide } from "@/components/hero-carousel";
import { ProductCard } from "@/components/product-card";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getCategoryTree, getFeaturedProducts, getNewArrivals } from "@/lib/queries/products";

export default async function HomePage() {
  const [sliderRows, categories, featured, newArrivals, lookbook] = await Promise.all([
    prisma.slider.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    getCategoryTree(),
    getFeaturedProducts(8),
    getNewArrivals(8),
    prisma.lookbookItem.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      take: 5,
    }),
  ]);

  const slides: HeroSlide[] = sliderRows.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    buttonText: s.buttonText,
    buttonLink: s.buttonLink,
    button2Text: s.button2Text,
    button2Link: s.button2Link,
    image: imageUrl(s.image),
    textPosition: s.textPosition,
    textColor: s.textColor,
    overlayOpacity: toNumber(s.overlayOpacity),
  }));

  return (
    <>
      <HeroCarousel slides={slides} />

      {/* Categories — asymmetric editorial tiles */}
      <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionHead
          kicker="Browse"
          title="Where to begin"
          href="/shop"
          linkLabel="All products"
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {categories.map((category, i) => {
            const image = imageUrl(category.image);
            return (
              <Link
                key={category.id}
                href={`/shop/category/${category.slug}`}
                className="group animate-rise relative block overflow-hidden bg-muted"
                style={{
                  animationDelay: `${i * 90}ms`,
                  // First tile runs taller to break the grid's rhythm.
                  aspectRatio: i === 0 ? "4 / 5" : "4 / 4.4",
                }}
              >
                {image && (
                  <SafeImage
                    src={image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <p className="kicker opacity-80">
                    {category._count.products}{" "}
                    {category._count.products === 1 ? "piece" : "pieces"}
                  </p>
                  <h3 className="mt-1.5 flex items-center gap-2 font-display text-3xl">
                    {category.name}
                    <ArrowRight
                      className="size-5 -translate-x-2 opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100"
                      strokeWidth={1.5}
                    />
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="rule-fade" />
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <SectionHead
            kicker="Selected"
            title="The pieces we would keep"
            href="/shop?sort=popular"
            linkLabel="Shop featured"
          />
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
            {featured.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Lookbook — offset mosaic */}
      {lookbook.length > 0 && (
        <section className="bg-secondary/40 py-20 lg:py-28">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
            <SectionHead kicker="Lookbook" title="Worn in" />

            <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {lookbook.map((item, i) => {
                const image = imageUrl(item.image);
                // The featured tile claims a 2×2 block on wide screens.
                const feature = i === 0;
                return (
                  <Link
                    key={item.id}
                    href={item.link ?? "/shop"}
                    className={`group animate-rise relative block overflow-hidden bg-muted ${
                      feature ? "col-span-2 row-span-2 aspect-square" : "aspect-[3/4]"
                    }`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    {image && (
                      <SafeImage
                        src={image}
                        alt={item.caption ?? ""}
                        fill
                        sizes={feature ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
                        className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                      />
                    )}
                    {item.caption && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent opacity-70 transition-opacity group-hover:opacity-95" />
                        <p
                          className={`absolute bottom-5 left-5 right-5 font-display text-white ${
                            feature ? "text-2xl lg:text-3xl" : "text-lg"
                          }`}
                        >
                          {item.caption}
                        </p>
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* New arrivals */}
      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <SectionHead
            kicker="Just in"
            title="New arrivals"
            href="/shop?sort=newest"
            linkLabel="Shop new"
          />
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
            {newArrivals.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function SectionHead({
  kicker,
  title,
  href,
  linkLabel,
}: {
  kicker: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="kicker text-[color:var(--accent)]">{kicker}</p>
        <h2 className="mt-2 font-display text-[clamp(1.9rem,4vw,3rem)] leading-tight">
          {title}
        </h2>
        <div className="rule-gold mt-4" />
      </div>
      {href && linkLabel && (
        <Link href={href} className="link-wipe kicker pb-1">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
