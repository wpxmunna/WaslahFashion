import Link from "next/link";
import { Plus } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { AdminSearch } from "@/components/admin/admin-search";
import { Pagination } from "@/components/pagination";
import { SafeImage } from "@/components/safe-image";
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
          <DataTable>
            <THead>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th align="right">Price</Th>
              <Th align="right">Stock</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {products.map((p) => {
                const src = imageUrl(p.images[0]?.path);
                const low = p.stockQuantity <= p.lowStockThreshold;
                return (
                  <tr key={p.id} className="hover:bg-secondary/40">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="relative size-11 shrink-0 overflow-hidden rounded bg-secondary">
                          <SafeImage
                            src={src}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                            fallbackLabel={p.name}
                          />
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="link-wipe block truncate font-medium"
                          >
                            {p.name}
                          </Link>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {p.sku ?? "No SKU"}
                            {p._count.variants > 0 && ` · ${p._count.variants} variants`}
                            {p.isFeatured && " · Featured"}
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td className="text-muted-foreground">{p.category?.name ?? "—"}</Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(effectivePrice(p.price, p.salePrice))}
                      {isOnSale(p.price, p.salePrice) && (
                        <span className="ml-1.5 text-xs text-muted-foreground line-through">
                          {formatPrice(toNumber(p.price))}
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span
                        className={cn(
                          "tabular-nums",
                          p.stockQuantity <= 0
                            ? "text-destructive"
                            : low
                              ? "text-amber-600"
                              : "",
                        )}
                      >
                        {p.stockQuantity}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </DataTable>
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
