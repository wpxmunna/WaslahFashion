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
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Couriers" };

const PER_PAGE = 20;

export default async function AdminCouriersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireStaff();

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const status = first(raw.status);

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {}),
  };

  const [couriers, total] = await Promise.all([
    prisma.courier.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        code: true,
        baseRate: true,
        perKgRate: true,
        estimatedDays: true,
        isActive: true,
        _count: { select: { shipments: true } },
      },
    }),
    prisma.courier.count({ where }),
  ]);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  return (
    <>
      <PageHeader
        title="Couriers"
        description={`${total} courier${total === 1 ? "" : "s"} configured.`}
        actions={
          <Link href="/admin/couriers/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New courier
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by name or code"
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All couriers" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ],
              },
            ]}
          />
        </div>

        {couriers.length === 0 ? (
          <EmptyState
            title={q || status ? "No matching couriers" : "No couriers yet"}
            description={
              q || status
                ? "Try a different search or clear the filters."
                : "Add a courier so orders can be shipped."
            }
            action={
              <Link href="/admin/couriers/new" className={buttonVariants()}>
                New courier
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Courier</Th>
              <Th align="right">Base rate</Th>
              <Th align="right">Per kg</Th>
              <Th>Est. days</Th>
              <Th align="right">Shipments</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {couriers.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/couriers/${c.id}`}
                      className="link-wipe block font-medium"
                    >
                      {c.name}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.code}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(c.baseRate)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(c.perKgRate)}
                  </Td>
                  <Td className="text-muted-foreground">{c.estimatedDays ?? "—"}</Td>
                  <Td align="right" className="tabular-nums text-muted-foreground">
                    {c._count.shipments}
                  </Td>
                  <Td>
                    <StatusBadge status={c.isActive ? "ACTIVE" : "INACTIVE"} />
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
        basePath="/admin/couriers"
      />
    </>
  );
}
