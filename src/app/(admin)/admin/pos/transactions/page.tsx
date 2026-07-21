import Link from "next/link";

import { AdminSearch } from "@/components/admin/admin-search";
import { PosDateRange } from "@/components/admin/pos-date-range";
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
import {
  endOfDay,
  PAYMENT_METHOD_LABELS,
  parseDateInput,
  POS_PAYMENT_METHODS,
  POS_TRANSACTION_STATUSES,
  type PosPaymentMethodValue,
} from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "POS transactions" };

const PER_PAGE = 20;

type TransactionStatus = (typeof POS_TRANSACTION_STATUSES)[number];

export default async function PosTransactionsPage({
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
  const method = first(raw.method);
  const from = parseDateInput(first(raw.from));
  const to = parseDateInput(first(raw.to));

  const isStatus = (v: string | undefined): v is TransactionStatus =>
    !!v && (POS_TRANSACTION_STATUSES as readonly string[]).includes(v);
  const isMethod = (v: string | undefined): v is PosPaymentMethodValue =>
    !!v && (POS_PAYMENT_METHODS as readonly string[]).includes(v);

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(isStatus(status) ? { status } : {}),
    ...(isMethod(method) ? { paymentMethod: method } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lt: endOfDay(to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { transactionNumber: { contains: q } },
            { customerName: { contains: q } },
            { customerPhone: { contains: q } },
          ],
        }
      : {}),
  };

  const [transactions, total, totals] = await Promise.all([
    prisma.posTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        transactionNumber: true,
        createdAt: true,
        customerName: true,
        customerPhone: true,
        paymentMethod: true,
        status: true,
        totalAmount: true,
        refundedAmount: true,
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.posTransaction.count({ where }),
    prisma.posTransaction.aggregate({
      where,
      _sum: { totalAmount: true, refundedAmount: true },
    }),
  ]);

  const query = new URLSearchParams();
  for (const [key, value] of [
    ["q", q],
    ["status", status],
    ["method", method],
    ["from", first(raw.from)],
    ["to", first(raw.to)],
  ] as const) {
    if (value) query.set(key, value);
  }

  const filtered = Boolean(q || status || method || from || to);
  const grossSales = toNumber(totals._sum.totalAmount);
  const refunded = toNumber(totals._sum.refundedAmount);

  return (
    <>
      <PageHeader
        title="POS transactions"
        description={`${total} transaction${total === 1 ? "" : "s"} match the current filters.`}
        breadcrumb={[
          { href: "/admin/pos", label: "POS" },
          { href: "/admin/pos/transactions", label: "Transactions" },
        ]}
        actions={
          <Link href="/admin/pos/refund" className={buttonVariants({ variant: "outline" })}>
            Process a refund
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Transactions" value={String(total)} />
        <StatCard label="Gross sales" value={formatPrice(grossSales)} />
        <StatCard
          label="Refunded"
          value={formatPrice(refunded)}
          hint={`Net ${formatPrice(grossSales - refunded)}`}
        />
      </div>

      <Panel>
        <div className="space-y-3 border-b border-border p-4">
          <AdminSearch
            placeholder="Search transaction number, customer or phone"
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "COMPLETED", label: "Completed" },
                  { value: "REFUNDED", label: "Refunded" },
                  { value: "VOID", label: "Void" },
                ],
              },
              {
                name: "method",
                label: "Payment method",
                options: [
                  { value: "", label: "All methods" },
                  ...POS_PAYMENT_METHODS.map((m) => ({
                    value: m,
                    label: PAYMENT_METHOD_LABELS[m],
                  })),
                ],
              },
            ]}
          />
          <PosDateRange />
        </div>

        {transactions.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching transactions" : "No transactions yet"}
            description={
              filtered
                ? "Try a different search or clear the filters."
                : "Sales taken at the till appear here."
            }
            action={
              <Link href="/admin/pos" className={buttonVariants()}>
                Open the terminal
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Transaction</Th>
              <Th>Date</Th>
              <Th>Customer</Th>
              <Th align="right">Items</Th>
              <Th>Payment</Th>
              <Th align="right">Total</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {transactions.map((t) => {
                const refund = toNumber(t.refundedAmount);
                return (
                  <tr key={t.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/pos/transactions/${t.id}`}
                        className="link-wipe font-medium"
                      >
                        {t.transactionNumber}
                      </Link>
                      {t.createdBy?.name && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t.createdBy.name}
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {t.createdAt.toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Td>
                    <Td>
                      {t.customerName ?? "Walk-in"}
                      {t.customerPhone && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {t.customerPhone}
                        </span>
                      )}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {t._count.items}
                    </Td>
                    <Td className="text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[t.paymentMethod]}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(toNumber(t.totalAmount))}
                      {refund > 0 && (
                        <span className="mt-0.5 block text-xs text-destructive">
                          −{formatPrice(refund)} refunded
                        </span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
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
        basePath="/admin/pos/transactions"
      />
    </>
  );
}
