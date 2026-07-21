import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
import { PO_STATUS_LABELS } from "@/components/admin/po-status-actions-constants";
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

const STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "ORDERED",
  "PARTIAL",
  "RECEIVED",
  "CANCELLED",
] as const;

export const metadata = { title: "Purchase orders" };

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function AdminPurchaseOrdersPage({
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
  const supplierRaw = Number(first(raw.supplier));
  const supplierId = Number.isInteger(supplierRaw) && supplierRaw > 0 ? supplierRaw : null;

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(status && (STATUSES as readonly string[]).includes(status)
      ? { status: status as (typeof STATUSES)[number] }
      : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(q ? { poNumber: { contains: q } } : {}),
  };

  const [orders, total, suppliers, outstanding] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: [{ orderDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        poNumber: true,
        orderDate: true,
        expectedDate: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
    prisma.supplier.findMany({
      where: { storeId: DEFAULT_STORE_ID },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { storeId: DEFAULT_STORE_ID, status: { not: "CANCELLED" } },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ]);

  const committed = toNumber(outstanding._sum.totalAmount);
  const settled = toNumber(outstanding._sum.paidAmount);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (supplierId) query.set("supplier", String(supplierId));

  const filtered = Boolean(q || status || supplierId);

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description={`${total} order${total === 1 ? "" : "s"}.`}
        actions={
          <Link
            href="/admin/purchase-orders/new"
            className={cn(buttonVariants(), "gap-1.5")}
          >
            <Plus className="size-4" strokeWidth={2} />
            New purchase order
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Committed"
          value={formatPrice(committed)}
          hint="Excludes cancelled orders."
        />
        <StatCard label="Paid" value={formatPrice(settled)} />
        <StatCard label="Outstanding" value={formatPrice(Math.max(0, committed - settled))} />
      </div>

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by PO number"
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All statuses" },
                  ...STATUSES.map((s) => ({ value: s, label: PO_STATUS_LABELS[s] })),
                ],
              },
              {
                name: "supplier",
                label: "Supplier",
                options: [
                  { value: "", label: "All suppliers" },
                  ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
                ],
              },
            ]}
          />
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching purchase orders" : "No purchase orders yet"}
            description={
              filtered
                ? "Try a different search or clear the filters."
                : "Raise a purchase order to restock from a supplier."
            }
            action={
              <Link href="/admin/purchase-orders/new" className={buttonVariants()}>
                New purchase order
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>PO number</Th>
              <Th>Supplier</Th>
              <Th>Order date</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th align="right">Total</Th>
            </THead>
            <TBody>
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/purchase-orders/${po.id}`}
                      className="link-wipe block font-medium"
                    >
                      {po.poNumber}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {po._count.items} line{po._count.items === 1 ? "" : "s"}
                      {po.expectedDate && ` · due ${formatDate(po.expectedDate)}`}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/suppliers/${po.supplier.id}`}
                      className="link-wipe text-muted-foreground"
                    >
                      {po.supplier.name}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{formatDate(po.orderDate)}</Td>
                  <Td>
                    <StatusBadge
                      status={po.status}
                      label={PO_STATUS_LABELS[po.status]}
                    />
                  </Td>
                  <Td>
                    <StatusBadge status={po.paymentStatus} />
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(po.totalAmount)}
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
        basePath="/admin/purchase-orders"
      />
    </>
  );
}
