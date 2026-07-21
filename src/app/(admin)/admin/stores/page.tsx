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
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Stores" };

const PER_PAGE = 20;

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const status = first(raw.status);

  const where = {
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { slug: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        isActive: true,
        isDefault: true,
        _count: { select: { products: true, orders: true } },
      },
    }),
    prisma.store.count({ where }),
  ]);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  return (
    <>
      <PageHeader
        title="Stores"
        description={`${total} store${total === 1 ? "" : "s"}.`}
        actions={
          <Link href="/admin/stores/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New store
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by name, slug or email"
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All stores" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ],
              },
            ]}
          />
        </div>

        {stores.length === 0 ? (
          <EmptyState
            title={q || status ? "No matching stores" : "No stores yet"}
            description={
              q || status
                ? "Try a different search or clear the filters."
                : "Create a store to start selling."
            }
            action={
              <Link href="/admin/stores/new" className={buttonVariants()}>
                New store
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Store</Th>
              <Th>Contact</Th>
              <Th align="right">Products</Th>
              <Th align="right">Orders</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {stores.map((s) => (
                <tr key={s.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/stores/${s.id}`}
                      className="link-wipe block font-medium"
                    >
                      {s.name}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      /{s.slug}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">
                    <span className="block text-sm">{s.email ?? "—"}</span>
                    <span className="block text-xs">{s.phone ?? "—"}</span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {s._count.products}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {s._count.orders}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={s.isActive ? "ACTIVE" : "INACTIVE"} />
                      {s.isDefault && <StatusBadge label="Default" tone="accent" />}
                    </span>
                  </Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        )}
      </Panel>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        baseQuery={query.toString()}
        basePath="/admin/stores"
      />
    </>
  );
}
