import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

const PER_PAGE = 20;

export const metadata = { title: "Suppliers" };

export default async function AdminSuppliersPage({
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
    ...(status && ["ACTIVE", "INACTIVE"].includes(status)
      ? { status: status as "ACTIVE" | "INACTIVE" }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };

  const [suppliers, total, totals] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        code: true,
        contactPerson: true,
        phone: true,
        paymentTerms: true,
        totalPurchases: true,
        totalPaid: true,
        status: true,
        _count: { select: { purchaseOrders: true } },
      },
    }),
    prisma.supplier.count({ where }),
    prisma.supplier.aggregate({
      where: { storeId: DEFAULT_STORE_ID },
      _sum: { totalPurchases: true, totalPaid: true },
    }),
  ]);

  const purchased = toNumber(totals._sum.totalPurchases);
  const paid = toNumber(totals._sum.totalPaid);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  return (
    <>
      <PageHeader
        title="Suppliers"
        description={`${total} supplier${total === 1 ? "" : "s"}.`}
        actions={
          <Link href="/admin/suppliers/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New supplier
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total purchased" value={formatPrice(purchased)} />
        <StatCard label="Total paid" value={formatPrice(paid)} />
        <StatCard
          label="Outstanding"
          value={formatPrice(Math.max(0, purchased - paid))}
          hint="Across every supplier."
        />
      </div>

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by name, code or email"
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ],
              },
            ]}
          />
        </div>

        {suppliers.length === 0 ? (
          <EmptyState
            title={q || status ? "No matching suppliers" : "No suppliers yet"}
            description={
              q || status
                ? "Try a different search or clear the filters."
                : "Add a supplier to start raising purchase orders."
            }
            action={
              <Link href="/admin/suppliers/new" className={buttonVariants()}>
                New supplier
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Supplier</Th>
              <Th>Contact</Th>
              <Th align="right">Terms</Th>
              <Th align="right">Purchased</Th>
              <Th align="right">Paid</Th>
              <Th align="right">Outstanding</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {suppliers.map((s) => {
                const supplierPurchased = toNumber(s.totalPurchases);
                const supplierPaid = toNumber(s.totalPaid);
                const outstanding = supplierPurchased - supplierPaid;

                return (
                  <tr key={s.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/suppliers/${s.id}`}
                        className="link-wipe block font-medium"
                      >
                        {s.name}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {s.code ?? "No code"} · {s._count.purchaseOrders} order
                        {s._count.purchaseOrders === 1 ? "" : "s"}
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">
                      <span className="block">{s.contactPerson ?? "—"}</span>
                      <span className="mt-0.5 block text-xs">{s.phone ?? ""}</span>
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {s.paymentTerms}d
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(supplierPurchased)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(supplierPaid)}
                    </Td>
                    <Td
                      align="right"
                      className={cn(
                        "tabular-nums",
                        outstanding > 0 ? "text-amber-600" : "text-muted-foreground",
                      )}
                    >
                      {formatPrice(outstanding)}
                    </Td>
                    <Td>
                      <StatusBadge status={s.status} />
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
        basePath="/admin/suppliers"
      />
    </>
  );
}
