import type { Metadata } from "next";

import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/components/product-card";
import { ShopToolbar } from "@/components/shop-toolbar";
import { parseShopParams, type RawSearchParams } from "@/lib/search-params";
import { listProducts } from "@/lib/queries/products";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every piece in the Waslah collection.",
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const { page, sort, minPrice, maxPrice, query } = parseShopParams(raw);

  const result = await listProducts({ page, sort, minPrice, maxPrice });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <header className="mb-8 max-w-2xl">
        <p className="kicker text-muted-foreground">The collection</p>
        <h1 className="mt-2 font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-tight">
          Everything we make
        </h1>
        <p className="mt-4 text-muted-foreground">
          Handloom, block print and everyday cotton — sourced directly from the people
          who make it.
        </p>
      </header>

      <ShopToolbar total={result.total} />

      {result.items.length === 0 ? (
        <EmptyState />
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
            basePath="/shop"
          />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-24 text-center">
      <p className="font-display text-2xl">Nothing matches those filters</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Try widening the price range or clearing your filters.
      </p>
    </div>
  );
}
