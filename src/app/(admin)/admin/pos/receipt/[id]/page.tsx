import Link from "next/link";
import { notFound } from "next/navigation";

import { PosPrintButton } from "@/components/admin/pos-print-button";
import { DEFAULT_STORE_ID, SITE } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/pos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Receipt" };

/**
 * Roughly 80mm of thermal paper. Rendered as a full-viewport overlay so the
 * admin sidebar and header do not appear behind or around it — the receipt is
 * the whole screen, and prints as the whole page.
 */
export default async function PosReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const transactionId = Number(id);
  if (!Number.isInteger(transactionId)) notFound();

  const [transaction, settings] = await Promise.all([
    prisma.posTransaction.findFirst({
      where: { id: transactionId, storeId: DEFAULT_STORE_ID },
      select: {
        id: true,
        transactionNumber: true,
        createdAt: true,
        customerName: true,
        customerPhone: true,
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
        createdBy: { select: { name: true } },
        terminal: { select: { name: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            productName: true,
            variantInfo: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            totalPrice: true,
          },
        },
        splitPayments: {
          orderBy: { id: "asc" },
          select: { id: true, paymentMethod: true, amount: true },
        },
      },
    }),
    prisma.setting.findMany({
      where: { storeId: DEFAULT_STORE_ID, group: "contact" },
      select: { key: true, value: true },
    }),
  ]);

  if (!transaction) notFound();

  const contact = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const businessName = contact.business_name || contact.company_name || SITE.name;
  const addressLines = [contact.address, contact.city].filter(Boolean).join(", ");
  const change = toNumber(transaction.changeAmount);
  const refunded = toNumber(transaction.refundedAmount);

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-neutral-100 py-8 print:static print:overflow-visible print:bg-white print:py-0">
      <div className="mx-auto w-[80mm] max-w-full">
        <div className="mb-3 flex items-center justify-between gap-2 px-1 print:hidden">
          <Link
            href={`/admin/pos/transactions/${transaction.id}`}
            className="text-xs text-neutral-600 underline underline-offset-2"
          >
            Back to transaction
          </Link>
          <PosPrintButton />
        </div>

        <article className="bg-white px-4 py-5 font-mono text-[11px] leading-snug text-black shadow-sm print:shadow-none">
          <header className="text-center">
            <h1 className="text-sm font-bold uppercase tracking-wide">{businessName}</h1>
            {addressLines && <p className="mt-0.5">{addressLines}</p>}
            {contact.phone && <p>Tel {contact.phone}</p>}
            {contact.email && <p>{contact.email}</p>}
          </header>

          <Divider />

          <dl className="space-y-0.5">
            <Line label="Receipt" value={transaction.transactionNumber} />
            <Line
              label="Date"
              value={transaction.createdAt.toLocaleString("en-GB", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            />
            <Line label="Cashier" value={transaction.createdBy?.name ?? "—"} />
            {transaction.terminal && (
              <Line label="Till" value={transaction.terminal.name} />
            )}
            {transaction.customerName && (
              <Line label="Customer" value={transaction.customerName} />
            )}
            {transaction.customerPhone && (
              <Line label="Phone" value={transaction.customerPhone} />
            )}
          </dl>

          <Divider />

          <table className="w-full">
            <caption className="sr-only">Items purchased</caption>
            <thead>
              <tr className="border-b border-dashed border-black/40">
                <th scope="col" className="py-1 text-left font-normal">
                  Item
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  Qty
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {transaction.items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="py-1 pr-1">
                    {item.productName}
                    {item.variantInfo && (
                      <span className="block text-[10px] opacity-70">
                        {item.variantInfo}
                      </span>
                    )}
                    <span className="block text-[10px] opacity-70">
                      @ {formatPrice(toNumber(item.unitPrice))}
                      {toNumber(item.discount) > 0 &&
                        ` less ${formatPrice(toNumber(item.discount))}`}
                    </span>
                  </td>
                  <td className="py-1 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-1 text-right tabular-nums">
                    {formatPrice(toNumber(item.totalPrice))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Divider />

          <dl className="space-y-0.5">
            <Line label="Subtotal" value={formatPrice(toNumber(transaction.subtotal))} />
            {toNumber(transaction.discountAmount) > 0 && (
              <Line
                label="Discount"
                value={`− ${formatPrice(toNumber(transaction.discountAmount))}`}
              />
            )}
            {toNumber(transaction.taxAmount) > 0 && (
              <Line label="Tax" value={formatPrice(toNumber(transaction.taxAmount))} />
            )}
            <div className="flex justify-between border-t border-dashed border-black/40 pt-1 text-xs font-bold">
              <dt>TOTAL</dt>
              <dd className="tabular-nums">
                {formatPrice(toNumber(transaction.totalAmount))}
              </dd>
            </div>
          </dl>

          <Divider />

          <dl className="space-y-0.5">
            <Line
              label="Paid by"
              value={PAYMENT_METHOD_LABELS[transaction.paymentMethod]}
            />
            {transaction.splitPayments.length > 0 ? (
              transaction.splitPayments.map((split) => (
                <Line
                  key={split.id}
                  label={PAYMENT_METHOD_LABELS[split.paymentMethod]}
                  value={formatPrice(toNumber(split.amount))}
                />
              ))
            ) : (
              <>
                {toNumber(transaction.cashReceived) > 0 && (
                  <Line
                    label="Cash"
                    value={formatPrice(toNumber(transaction.cashReceived))}
                  />
                )}
                {toNumber(transaction.cardAmount) > 0 && (
                  <Line
                    label="Card"
                    value={formatPrice(toNumber(transaction.cardAmount))}
                  />
                )}
                {toNumber(transaction.mobileAmount) > 0 && (
                  <Line
                    label="Mobile"
                    value={formatPrice(toNumber(transaction.mobileAmount))}
                  />
                )}
              </>
            )}
            {change > 0 && <Line label="Change" value={formatPrice(change)} />}
            {refunded > 0 && <Line label="Refunded" value={formatPrice(refunded)} />}
          </dl>

          <Divider />

          <footer className="text-center">
            <p className="font-bold">Thank you for shopping with us.</p>
            <p className="mt-0.5 text-[10px] opacity-70">
              Keep this receipt for exchanges and refunds.
            </p>
            {transaction.status !== "COMPLETED" && (
              <p className="mt-1 font-bold uppercase">{transaction.status}</p>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-black/40" />;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 opacity-70">{label}</dt>
      <dd className="truncate text-right tabular-nums">{value}</dd>
    </div>
  );
}
