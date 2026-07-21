import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { ProductCard } from "@/components/product-card";
import { ShopToolbar } from "@/components/shop-toolbar";
import { SearchField } from "@/components/search-field";
import { parseShopParams, type RawSearchParams } from "@/lib/search-params";
import { listProducts } from "@/lib/queries/products";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const { page, sort, minPrice, maxPrice, search, query } = parseShopParams(raw);

  // Legacy forced `created_at DESC` on search and ignored the sort parameter.
  const result = search
    ? await listProducts({ page, sort, minPrice, maxPrice, search })
    : null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <header className="mb-8 max-w-2xl">
        <p className="kicker text-muted-foreground">Search</p>
        <h1 className="mt-2 font-display text-[clamp(2.2rem,5vw,3.5rem)] leading-tight">
          {search ? <>Results for “{search}”</> : "What are you looking for?"}
        </h1>
        <div className="mt-6">
          <SearchField className="max-w-md" />
        </div>
      </header>

      {!result ? (
        <p className="py-16 text-muted-foreground">
          Enter a search term above, or{" "}
          <Link href="/shop" className="link-wipe">
            browse the full collection
          </Link>
          .
        </p>
      ) : result.items.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-display text-2xl">No matches for “{search}”</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the spelling, or{" "}
            <Link href="/shop" className="link-wipe">
              browse everything
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <ShopToolbar total={result.total} />
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
            {result.items.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            baseQuery={query}
            basePath="/search"
          />
        </>
      )}
    </div>
  );
}
