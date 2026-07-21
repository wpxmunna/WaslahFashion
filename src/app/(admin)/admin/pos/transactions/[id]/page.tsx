import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, RotateCcw } from "lucide-react";

import {
  DataTable,
  PageHeader,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, REFUND_METHOD_LABELS } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata = { title: "POS transaction" };

export default async function PosTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transactionId = Number(id);
  if (!Number.isInteger(transactionId)) notFound();

  const transaction = await prisma.posTransaction.findFirst({
    where: { id: transactionId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      transactionNumber: true,
      createdAt: true,
      customerName: true,
      customerPhone: true,
      customer: { select: { id: true, name: true } },
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      totalAmount: true,
      paymentMethod: true,
      cashReceived: true,
      changeAmount: true,
      cardAmount: true,
      mobileAmount: true,
      status: true,
      refundedAmount: true,
      notes: true,
      createdBy: { select: { name: true } },
      terminal: { select: { name: true } },
      shift: { select: { id: true, shiftNumber: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          productName: true,
          productSku: true,
          variantInfo: true,
          quantity: true,
          unitPrice: true,
          discount: true,
          totalPrice: true,
        },
      },
      splitPayments: {
        orderBy: { id: "asc" },
        select: { id: true, paymentMethod: true, amount: true, referenceNumber: true },
      },
      refunds: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          refundNumber: true,
          refundAmount: true,
          refundMethod: true,
          reason: true,
          status: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!transaction) notFound();

  const refunded = toNumber(transaction.refundedAmount);
  const total = toNumber(transaction.totalAmount);

  return (
    <>
      <PageHeader
        title={transaction.transactionNumber}
        description={`${transaction.createdAt.toLocaleString("en-GB", {
          dateStyle: "full",
          timeStyle: "short",
        })}${transaction.terminal ? ` · ${transaction.terminal.name}` : ""}`}
        breadcrumb={[
          { href: "/admin/pos", label: "POS" },
          { href: "/admin/pos/transactions", label: "Transactions" },
          {
            href: `/admin/pos/transactions/${transaction.id}`,
            label: transaction.transactionNumber,
          },
        ]}
        actions={
          <>
            <Link
              href={`/admin/pos/receipt/${transaction.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Printer className="size-4" strokeWidth={1.8} />
              Receipt
            </Link>
            {refunded < total && transaction.status !== "VOID" && (
              <Link
                href={`/admin/pos/refund?number=${encodeURIComponent(transaction.transactionNumber)}`}
                className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
              >
                <RotateCcw className="size-4" strokeWidth={1.8} />
                Refund
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Items">
            <DataTable>
              <THead>
                <Th>Product</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Unit</Th>
                <Th align="right">Discount</Th>
                <Th align="right">Total</Th>
              </THead>
              <TBody>
                {transaction.items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      {item.productId ? (
                        <Link
                          href={`/admin/products/${item.productId}`}
                          className="link-wipe font-medium"
                        >
                          {item.productName}
                        </Link>
                      ) : (
                        <span className="font-medium">{item.productName}</span>
                      )}
                      {(item.productSku || item.variantInfo) && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {[item.productSku, item.variantInfo].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {item.quantity}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(toNumber(item.unitPrice))}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(toNumber(item.discount))}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(toNumber(item.totalPrice))}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>

            <dl className="space-y-1.5 border-t border-border p-5 text-sm">
              <Row label="Subtotal" value={toNumber(transaction.subtotal)} />
              <Row label="Discount" value={-toNumber(transaction.discountAmount)} />
              <Row label="Tax" value={toNumber(transaction.taxAmount)} />
              <div className="flex justify-between border-t border-border pt-1.5 font-display text-base">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(total)}</dd>
              </div>
            </dl>
          </Panel>

          {transaction.refunds.length > 0 && (
            <Panel title="Refunds">
              <DataTable>
                <THead>
                  <Th>Refund</Th>
                  <Th>Date</Th>
                  <Th>Reason</Th>
                  <Th>Method</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                </THead>
                <TBody>
                  {transaction.refunds.map((refund) => (
                    <tr key={refund.id}>
                      <Td className="font-medium">{refund.refundNumber}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {refund.createdAt.toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </Td>
                      <Td className="text-muted-foreground">{refund.reason ?? "—"}</Td>
                      <Td className="text-muted-foreground">
                        {REFUND_METHOD_LABELS[refund.refundMethod]}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {formatPrice(toNumber(refund.refundAmount))}
                      </Td>
                      <Td>
                        <StatusBadge status={refund.status} />
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Payment">
            <dl className="space-y-1.5 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Method</dt>
                <dd>{PAYMENT_METHOD_LABELS[transaction.paymentMethod]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={transaction.status} />
                </dd>
              </div>

              {transaction.splitPayments.length > 0 ? (
                transaction.splitPayments.map((split) => (
                  <Row
                    key={split.id}
                    label={PAYMENT_METHOD_LABELS[split.paymentMethod]}
                    value={toNumber(split.amount)}
                  />
                ))
              ) : (
                <>
                  {toNumber(transaction.cashReceived) > 0 && (
                    <Row label="Cash received" value={toNumber(transaction.cashReceived)} />
                  )}
                  {toNumber(transaction.cardAmount) > 0 && (
                    <Row label="Card" value={toNumber(transaction.cardAmount)} />
                  )}
                  {toNumber(transaction.mobileAmount) > 0 && (
                    <Row label="Mobile banking" value={toNumber(transaction.mobileAmount)} />
                  )}
                </>
              )}

              {toNumber(transaction.changeAmount) > 0 && (
                <Row label="Change given" value={toNumber(transaction.changeAmount)} />
              )}
              {refunded > 0 && <Row label="Refunded" value={-refunded} />}
            </dl>
          </Panel>

          <Panel title="Details">
            <dl className="space-y-2 p-5 text-sm">
              <Detail label="Customer">
                {transaction.customer?.name ?? transaction.customerName ?? "Walk-in"}
              </Detail>
              {transaction.customerPhone && (
                <Detail label="Phone">{transaction.customerPhone}</Detail>
              )}
              <Detail label="Cashier">{transaction.createdBy?.name ?? "—"}</Detail>
              <Detail label="Terminal">{transaction.terminal?.name ?? "—"}</Detail>
              <Detail label="Shift">
                {transaction.shift ? (
                  <Link
                    href={`/admin/pos/shifts/${transaction.shift.id}`}
                    className="link-wipe"
                  >
                    {transaction.shift.shiftNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </Detail>
              {transaction.notes && <Detail label="Notes">{transaction.notes}</Detail>}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{formatPrice(value)}</dd>
    </div>
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
