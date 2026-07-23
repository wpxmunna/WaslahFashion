import Link from "next/link";
import { Plus } from "lucide-react";

import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import { AdminSearch } from "@/components/admin/admin-search";
import { ProductBulkTable } from "@/components/admin/product-bulk-table";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { effectivePrice, formatPrice, isOnSale, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

const PER_PAGE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const status = first(raw.status);

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(status && ["ACTIVE", "INACTIVE", "DRAFT"].includes(status)
      ? { status: status as "ACTIVE" | "INACTIVE" | "DRAFT" }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { barcode: { contains: q } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        salePrice: true,
        stockQuantity: true,
        lowStockThreshold: true,
        status: true,
        isFeatured: true,
        category: { select: { name: true } },
        images: {
          select: { path: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
        },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    variants: p._count.variants,
    featured: p.isFeatured,
    category: p.category?.name ?? null,
    imageSrc: imageUrl(p.images[0]?.path),
    priceDisplay: formatPrice(effectivePrice(p.price, p.salePrice)),
    originalDisplay: isOnSale(p.price, p.salePrice) ? formatPrice(toNumber(p.price)) : null,
    stock: p.stockQuantity,
    low: p.stockQuantity <= p.lowStockThreshold,
    status: p.status,
  }));

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"} in the catalogue.`}
        actions={
          <Link href="/admin/products/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New product
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by name, SKU or barcode"
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "INACTIVE", label: "Inactive" },
                ],
              },
            ]}
          />
        </div>

        {products.length === 0 ? (
          <EmptyState
            title={q || status ? "No matching products" : "No products yet"}
            description={
              q || status
                ? "Try a different search or clear the filters."
                : "Add your first product to start selling."
            }
            action={
              <Link href="/admin/products/new" className={buttonVariants()}>
                New product
              </Link>
            }
          />
        ) : (
          <ProductBulkTable products={rows} />
        )}
      </Panel>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        baseQuery={query.toString()}
        basePath="/admin/products"
      />
    </>
  );
}
