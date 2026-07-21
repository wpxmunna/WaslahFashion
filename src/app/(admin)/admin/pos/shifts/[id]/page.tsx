import Link from "next/link";
import { notFound } from "next/navigation";

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
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { CASH_LOG_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata = { title: "POS shift" };

export default async function PosShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shiftId = Number(id);
  if (!Number.isInteger(shiftId)) notFound();

  const shift = await prisma.posShift.findFirst({
    where: { id: shiftId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      shiftNumber: true,
      openingTime: true,
      closingTime: true,
      openingCash: true,
      expectedCash: true,
      actualCash: true,
      cashDifference: true,
      totalSales: true,
      totalTransactions: true,
      totalRefunds: true,
      status: true,
      notes: true,
      user: { select: { name: true } },
      terminal: { select: { name: true, location: true } },
      transactions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          transactionNumber: true,
          createdAt: true,
          customerName: true,
          paymentMethod: true,
          totalAmount: true,
          status: true,
        },
      },
      cashLogs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          amount: true,
          reason: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!shift) notFound();

  const difference = toNumber(shift.cashDifference);

  return (
    <>
      <PageHeader
        title={shift.shiftNumber}
        description={`${shift.user.name} · ${shift.terminal.name}${
          shift.terminal.location ? ` (${shift.terminal.location})` : ""
        }`}
        breadcrumb={[
          { href: "/admin/pos", label: "POS" },
          { href: "/admin/pos/shifts", label: "Shifts" },
          { href: `/admin/pos/shifts/${shift.id}`, label: shift.shiftNumber },
        ]}
        actions={<StatusBadge status={shift.status} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales"
          value={formatPrice(toNumber(shift.totalSales))}
          hint={`${shift.totalTransactions} transaction${
            shift.totalTransactions === 1 ? "" : "s"
          }`}
        />
        <StatCard label="Refunds" value={formatPrice(toNumber(shift.totalRefunds))} />
        <StatCard
          label="Expected cash"
          value={formatPrice(toNumber(shift.expectedCash))}
          hint={`Opened with ${formatPrice(toNumber(shift.openingCash))}`}
        />
        <StatCard
          label="Counted cash"
          value={formatPrice(toNumber(shift.actualCash))}
          hint={
            shift.status === "CLOSED"
              ? difference === 0
                ? "Balanced"
                : `${difference > 0 ? "Over" : "Short"} by ${formatPrice(Math.abs(difference))}`
              : "Shift still open"
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel
          title="Transactions"
          description={`Sales rung up on ${shift.shiftNumber}.`}
        >
          {shift.transactions.length === 0 ? (
            <EmptyState
              title="No sales on this shift"
              description="Nothing was rung up before the drawer was closed."
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Transaction</Th>
                <Th>Time</Th>
                <Th>Customer</Th>
                <Th>Payment</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
              </THead>
              <TBody>
                {shift.transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/pos/transactions/${t.id}`}
                        className="link-wipe font-medium"
                      >
                        {t.transactionNumber}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {t.createdAt.toLocaleTimeString("en-GB", { timeStyle: "short" })}
                    </Td>
                    <Td>{t.customerName ?? "Walk-in"}</Td>
                    <Td className="text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[t.paymentMethod]}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(toNumber(t.totalAmount))}
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Cash log" description="Drawer movements outside of sales.">
            {shift.cashLogs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No cash was moved in or out.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {shift.cashLogs.map((log) => (
                  <li key={log.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">
                        {CASH_LOG_LABELS[log.type] ?? log.type}
                      </span>
                      <span
                        className={cn(
                          "text-sm tabular-nums",
                          log.type === "CASH_OUT" ? "text-destructive" : "",
                        )}
                      >
                        {log.type === "CASH_OUT" ? "−" : "+"}
                        {formatPrice(toNumber(log.amount))}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {log.reason ?? "No reason given"} ·{" "}
                      {log.createdAt.toLocaleTimeString("en-GB", { timeStyle: "short" })}
                      {log.createdBy?.name ? ` · ${log.createdBy.name}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Shift">
            <dl className="space-y-2 p-5 text-sm">
              <Detail label="Opened">
                {shift.openingTime.toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Detail>
              <Detail label="Closed">
                {shift.closingTime
                  ? shift.closingTime.toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "Still open"}
              </Detail>
              <Detail label="Cashier">{shift.user.name}</Detail>
              <Detail label="Terminal">{shift.terminal.name}</Detail>
              {shift.notes && <Detail label="Notes">{shift.notes}</Detail>}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
