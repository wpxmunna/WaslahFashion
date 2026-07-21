import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/components/product-card";
import { ShopToolbar } from "@/components/shop-toolbar";
import { parseShopParams, type RawSearchParams } from "@/lib/search-params";
import { getCategoryBySlug, listProducts } from "@/lib/queries/products";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };

  return {
    title: category.name,
    description: category.description ?? `Shop ${category.name} at Waslah.`,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const { page, sort, minPrice, maxPrice, query } = parseShopParams(raw);

  const result = await listProducts({
    page,
    sort,
    minPrice,
    maxPrice,
    categoryId: category.id,
    // Parent categories show their children's products too.
    includeChildCategories: true,
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <header className="mb-8 max-w-2xl">
        <p className="kicker text-muted-foreground">
          {category.parent ? (
            <Link href={`/shop/category/${category.parent.slug}`} className="link-wipe">
              {category.parent.name}
            </Link>
          ) : (
            "Category"
          )}
        </p>
        <h1 className="mt-2 font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-tight">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-4 text-muted-foreground">{category.description}</p>
        )}
      </header>

      {category.children.length > 0 && (
        <nav aria-label="Subcategories" className="mb-8 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={`/shop/category/${child.slug}`}
              className="border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
            >
              {child.name}
            </Link>
          ))}
        </nav>
      )}

      <ShopToolbar total={result.total} />

      {result.items.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-display text-2xl">Nothing here yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another category, or{" "}
            <Link href="/shop" className="link-wipe">
              browse everything
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
            {result.items.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            baseQuery={query}
            basePath={`/shop/category/${category.slug}`}
          />
        </>
      )}
    </div>
  );
}
