import Link from "next/link";
import { format } from "date-fns";
import { Plus } from "lucide-react";

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
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { returnReasonLabel } from "@/lib/returns";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Returns" };

const PER_PAGE = 20;
const REFUND_STATUSES = ["NOT_REQUIRED", "PENDING", "COMPLETED"];

type RefundStatus = "NOT_REQUIRED" | "PENDING" | "COMPLETED";

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const refund = first(raw.refund);

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(refund && REFUND_STATUSES.includes(refund)
      ? { refundStatus: refund as RefundStatus }
      : {}),
    ...(q
      ? {
          OR: [
            { returnNumber: { contains: q } },
            { order: { orderNumber: { contains: q } } },
          ],
        }
      : {}),
  };

  const [returns, total] = await Promise.all([
    prisma.return.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        returnNumber: true,
        reason: true,
        refundAmount: true,
        refundStatus: true,
        returnedAt: true,
        order: {
          select: { id: true, orderNumber: true, user: { select: { name: true } } },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.return.count({ where }),
  ]);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (refund) query.set("refund", refund);

  const filtered = Boolean(q || refund);

  return (
    <>
      <PageHeader
        title="Returns"
        description={`${total} return${total === 1 ? "" : "s"} recorded.`}
        actions={
          <Link href="/admin/returns/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            Record return
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by return or order number"
            filters={[
              {
                name: "refund",
                label: "Refund status",
                options: [
                  { value: "", label: "All refunds" },
                  { value: "NOT_REQUIRED", label: "Not required" },
                  { value: "PENDING", label: "Pending" },
                  { value: "COMPLETED", label: "Completed" },
                ],
              },
            ]}
          />
        </div>

        {returns.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching returns" : "No returns yet"}
            description={
              filtered
                ? "Try a different search or clear the filters."
                : "Record a return to put stock back and track the refund."
            }
            action={
              <Link href="/admin/returns/new" className={buttonVariants()}>
                Record return
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Return</Th>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Reason</Th>
              <Th align="right">Items</Th>
              <Th>Refund</Th>
              <Th align="right">Amount</Th>
            </THead>
            <TBody>
              {returns.map((r) => (
                <tr key={r.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/returns/${r.id}`}
                      className="link-wipe block font-medium"
                    >
                      {r.returnNumber}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {format(r.returnedAt, "d MMM yyyy")}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${r.order.id}`}
                      className="link-wipe text-sm"
                    >
                      {r.order.orderNumber}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">
                    {r.order.user?.name ?? "Guest"}
                  </Td>
                  <Td className="text-muted-foreground">
                    {returnReasonLabel(r.reason)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {r._count.items}
                  </Td>
                  <Td>
                    <StatusBadge status={r.refundStatus} />
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(r.refundAmount)}
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
        basePath="/admin/returns"
      />
    </>
  );
}
