import Link from "next/link";
import { CornerDownRight, Plus } from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
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
import { SafeImage } from "@/components/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Categories" };

type Row = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  image: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
};

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const q = first(raw.q)?.trim() ?? "";
  const active = first(raw.active);

  // The whole tree is loaded rather than paginated: a page of rows would cut
  // children away from their parents and the nesting would read as nonsense.
  const categories: Row[] = await prisma.category.findMany({
    where: {
      storeId: DEFAULT_STORE_ID,
      ...(active === "1" ? { isActive: true } : {}),
      ...(active === "0" ? { isActive: false } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      name: true,
      slug: true,
      image: true,
      icon: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });

  const byId = new Map(categories.map((c) => [c.id, c]));
  const childrenOf = new Map<number, Row[]>();
  const roots: Row[] = [];

  for (const c of categories) {
    // A parent filtered out by the active filter (or belonging to another
    // store) would strand its children, so those float up to the top level.
    if (c.parentId !== null && byId.has(c.parentId)) {
      const list = childrenOf.get(c.parentId) ?? [];
      list.push(c);
      childrenOf.set(c.parentId, list);
    } else {
      roots.push(c);
    }
  }

  const needle = q.toLowerCase();
  const matches = (c: Row) => c.name.toLowerCase().includes(needle);

  const visible: { row: Row; depth: number }[] = [];

  /**
   * Depth-first walk so the tree reads top-down. A branch survives the search
   * if it matches or holds a match; once a node matches, its whole subtree is
   * kept so the admin can see what sits underneath it.
   */
  function walk(row: Row, depth: number, forced: boolean): boolean {
    const self = forced || !q || matches(row);
    const at = visible.length;
    visible.push({ row, depth });

    let keptChild = false;
    for (const kid of childrenOf.get(row.id) ?? []) {
      if (walk(kid, depth + 1, self)) keptChild = true;
    }

    if (!self && !keptChild) {
      visible.splice(at, 1);
      return false;
    }
    return true;
  }

  for (const root of roots) walk(root, 0, false);

  const total = categories.length;
  const parentCount = roots.length;

  return (
    <>
      <PageHeader
        title="Categories"
        description={`${total} categor${total === 1 ? "y" : "ies"} across ${parentCount} top-level group${parentCount === 1 ? "" : "s"}.`}
        actions={
          <Link href="/admin/categories/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New category
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search categories by name"
            filters={[
              {
                name: "active",
                label: "Visibility",
                options: [
                  { value: "", label: "All categories" },
                  { value: "1", label: "Active only" },
                  { value: "0", label: "Inactive only" },
                ],
              },
            ]}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={q || active ? "No matching categories" : "No categories yet"}
            description={
              q || active
                ? "Try a different search or clear the filters."
                : "Categories group your products in the shop navigation."
            }
            action={
              <Link href="/admin/categories/new" className={buttonVariants()}>
                New category
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Category</Th>
              <Th align="right">Products</Th>
              <Th align="right">Sort order</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {visible.map(({ row, depth }) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <Td>
                    <div
                      className="flex items-center gap-3"
                      style={depth > 0 ? { paddingLeft: `${depth * 1.5}rem` } : undefined}
                    >
                      {depth > 0 && (
                        <CornerDownRight
                          className="size-3.5 shrink-0 text-muted-foreground"
                          strokeWidth={1.7}
                          aria-hidden
                        />
                      )}
                      <span className="relative size-10 shrink-0 overflow-hidden rounded bg-secondary">
                        <SafeImage
                          src={imageUrl(row.image)}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                          fallbackLabel={row.name}
                        />
                      </span>
                      <span className="min-w-0">
                        <Link
                          href={`/admin/categories/${row.id}`}
                          className="link-wipe block truncate font-medium"
                        >
                          {row.name}
                        </Link>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          /{row.slug}
                          {row.icon && ` · ${row.icon}`}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {row._count.products}
                  </Td>
                  <Td align="right" className="tabular-nums text-muted-foreground">
                    {row.sortOrder}
                  </Td>
                  <Td>
                    <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} />
                  </Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        )}
      </Panel>
    </>
  );
}
