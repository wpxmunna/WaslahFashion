import Link from "next/link";
import { Plus } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import {
  FeatureButton,
  ReorderButtons,
  ToggleActiveButton,
} from "@/components/admin/content-row-actions";
import {
  featureLookbookItem,
  moveLookbookItem,
  toggleLookbookActive,
} from "@/actions/admin/lookbook";
import { AdminSearch } from "@/components/admin/admin-search";
import { Pagination } from "@/components/pagination";
import { SafeImage } from "@/components/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Lookbook" };

const PER_PAGE = 20;

export default async function AdminLookbookPage({
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
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "hidden" ? { isActive: false } : {}),
    ...(q ? { caption: { contains: q } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.lookbookItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        image: true,
        link: true,
        caption: true,
        isFeatured: true,
        sortOrder: true,
        isActive: true,
      },
    }),
    prisma.lookbookItem.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  return (
    <>
      <PageHeader
        title="Lookbook"
        description={`${total} item${total === 1 ? "" : "s"}. The homepage mosaic shows the first five.`}
        breadcrumb={[{ href: "/admin", label: "Dashboard" }]}
        actions={
          <Link href="/admin/lookbook/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New item
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search captions"
            filters={[
              {
                name: "status",
                label: "Visibility",
                options: [
                  { value: "", label: "All items" },
                  { value: "active", label: "Live" },
                  { value: "hidden", label: "Hidden" },
                ],
              },
            ]}
          />
        </div>

        {items.length === 0 ? (
          <EmptyState
            title={q || status ? "No matching items" : "No lookbook items yet"}
            description={
              q || status
                ? "Try a different search or clear the filters."
                : "Add photographs of the pieces being worn."
            }
            action={
              <Link href="/admin/lookbook/new" className={buttonVariants()}>
                New item
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Item</Th>
              <Th align="center">Featured</Th>
              <Th align="center">Order</Th>
              <Th align="center">Reorder</Th>
              <Th align="center">Visibility</Th>
            </THead>
            <TBody>
              {items.map((item, i) => {
                const label = item.caption ?? `Item ${item.id}`;
                return (
                  <tr key={item.id} className="hover:bg-secondary/40">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded bg-secondary">
                          <SafeImage
                            src={imageUrl(item.image)}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                            fallbackLabel={label}
                          />
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={`/admin/lookbook/${item.id}`}
                            className="link-wipe block truncate font-medium"
                          >
                            {item.caption ?? "Untitled"}
                          </Link>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {item.link ?? "No link"}
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td align="center">
                      <FeatureButton
                        id={item.id}
                        action={featureLookbookItem}
                        isFeatured={item.isFeatured}
                        label={label}
                      />
                    </Td>
                    <Td align="center" className="tabular-nums text-muted-foreground">
                      {item.sortOrder}
                    </Td>
                    <Td align="center">
                      <ReorderButtons
                        id={item.id}
                        action={moveLookbookItem}
                        isFirst={page === 1 && i === 0}
                        isLast={page === totalPages && i === items.length - 1}
                        label={label}
                      />
                    </Td>
                    <Td align="center">
                      <ToggleActiveButton
                        id={item.id}
                        action={toggleLookbookActive}
                        isActive={item.isActive}
                        label={label}
                      />
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
        totalPages={totalPages}
        baseQuery={query.toString()}
        basePath="/admin/lookbook"
      />
    </>
  );
}
