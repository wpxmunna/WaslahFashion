"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import {
  lookupTransactionForRefund,
  processRefund,
  type RefundLookup,
} from "@/actions/admin/pos";
import { Panel, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  POS_REFUND_METHODS,
  REFUND_METHOD_LABELS,
  round2,
  type PosPaymentMethodValue,
  type PosRefundMethodValue,
} from "@/lib/pos";
import { cn } from "@/lib/utils";

const controlClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";

export function PosRefundForm({ initialNumber = "" }: { initialNumber?: string }) {
  const router = useRouter();

  const [number, setNumber] = useState(initialNumber);
  const [transaction, setTransaction] = useState<RefundLookup | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<PosRefundMethodValue>("CASH");
  const [notes, setNotes] = useState("");

  const [looking, startLookup] = useTransition();
  const [saving, startSave] = useTransition();

  function lookup(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Enter a transaction number.");
      return;
    }
    startLookup(async () => {
      const result = await lookupTransactionForRefund(trimmed);
      if (!result.ok || !result.transaction) {
        setTransaction(null);
        toast.error(result.message ?? "Transaction not found.");
        return;
      }
      setTransaction(result.transaction);
      setQuantities({});
      setReason("");
      setNotes("");
    });
  }

  // Deep link from a transaction page: look it up straight away.
  useEffect(() => {
    if (initialNumber.trim()) lookup(initialNumber);
    // Intentionally runs once, for the initial query string only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refundTotal = transaction
    ? round2(
        transaction.items.reduce((sum, item) => {
          const qty = quantities[item.id] ?? 0;
          if (qty <= 0) return sum;
          const perUnit = round2(item.totalPrice / item.quantity);
          return sum + perUnit * qty;
        }, 0),
      )
    : 0;

  const overBalance = transaction ? refundTotal > transaction.refundableAmount + 0.01 : false;
  const canSubmit =
    !!transaction && refundTotal > 0 && reason.trim().length >= 3 && !overBalance;

  function submit() {
    if (!transaction) return;

    const items = Object.entries(quantities)
      .map(([itemId, quantity]) => ({ itemId: Number(itemId), quantity }))
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      toast.error("Choose at least one item to refund.");
      return;
    }

    startSave(async () => {
      const result = await processRefund({
        transactionId: transaction.id,
        items,
        reason: reason.trim(),
        refundMethod: method,
        notes: notes.trim() || undefined,
      });

      if (!result.ok) {
        toast.error(result.message ?? "Could not process the refund.");
        return;
      }

      toast.success(result.message ?? "Refund processed.");
      router.push(`/admin/pos/transactions/${transaction.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <Panel title="Find the sale" description="Refunds start from the original receipt.">
        <form
          className="flex flex-wrap items-end gap-3 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            lookup(number);
          }}
        >
          <div className="min-w-56 flex-1">
            <label htmlFor="refund-number" className="text-sm font-medium">
              Transaction number
            </label>
            <div className="relative mt-1.5">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.7}
              />
              <input
                id="refund-number"
                value={number}
                autoFocus
                autoComplete="off"
                onChange={(event) => setNumber(event.target.value)}
                placeholder="TXN-20260721-A3F91C"
                className={cn(controlClass, "pl-9 font-mono")}
              />
            </div>
          </div>
          <Button type="submit" disabled={looking}>
            {looking && <Loader2 className="size-4 animate-spin" />}
            Look up
          </Button>
        </form>
      </Panel>

      {transaction && (
        <>
          <Panel
            title={transaction.transactionNumber}
            description={`${new Date(transaction.createdAt).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })} · ${transaction.customerName ?? "Walk-in"} · paid by ${
              PAYMENT_METHOD_LABELS[transaction.paymentMethod as PosPaymentMethodValue] ??
              transaction.paymentMethod
            }`}
            actions={<StatusBadge status={transaction.status} />}
          >
            <div className="grid gap-4 border-b border-border p-5 text-sm sm:grid-cols-3">
              <Figure label="Sale total" value={formatPrice(transaction.totalAmount)} />
              <Figure
                label="Already refunded"
                value={formatPrice(transaction.refundedAmount)}
              />
              <Figure
                label="Refundable balance"
                value={formatPrice(transaction.refundableAmount)}
              />
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-border bg-secondary/40">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Item
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Sold
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Refundable
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Refund qty
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transaction.items.map((item) => {
                    const remaining = item.quantity - item.refundedQuantity;
                    const qty = quantities[item.id] ?? 0;
                    const perUnit = round2(item.totalPrice / item.quantity);

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium">{item.productName}</span>
                          {(item.productSku || item.variantInfo) && (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {[item.productSku, item.variantInfo]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {formatPrice(perUnit)} each after discount
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {remaining}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            step={1}
                            disabled={remaining <= 0}
                            value={qty || ""}
                            placeholder="0"
                            aria-label={`Quantity of ${item.productName} to refund`}
                            onChange={(event) => {
                              const raw = Math.trunc(Number(event.target.value));
                              const next = Number.isFinite(raw)
                                ? Math.min(Math.max(0, raw), remaining)
                                : 0;
                              setQuantities((current) => ({
                                ...current,
                                [item.id]: next,
                              }));
                            }}
                            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-primary disabled:opacity-40"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {formatPrice(round2(perUnit * qty))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Refund details">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <label htmlFor="refund-reason" className="text-sm font-medium">
                  Reason<span className="ml-0.5 text-destructive">*</span>
                </label>
                <input
                  id="refund-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Faulty, wrong size, changed mind…"
                  maxLength={100}
                  className={cn(controlClass, "mt-1.5")}
                />
              </div>

              <div>
                <label htmlFor="refund-method" className="text-sm font-medium">
                  Refund method
                </label>
                <select
                  id="refund-method"
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as PosRefundMethodValue)
                  }
                  className={cn(controlClass, "mt-1.5")}
                >
                  {POS_REFUND_METHODS.map((value) => (
                    <option key={value} value={value}>
                      {REFUND_METHOD_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="refund-notes" className="text-sm font-medium">
                  Notes
                </label>
                <textarea
                  id="refund-notes"
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={cn(controlClass, "mt-1.5 resize-y")}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
              <div>
                <p className="font-display text-lg tabular-nums">
                  {formatPrice(refundTotal)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {overBalance
                    ? "More than the un-refunded balance of this sale."
                    : "Total to refund. Stock is returned automatically."}
                </p>
              </div>
              <Button type="button" disabled={!canSubmit || saving} onClick={submit}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Process refund
              </Button>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="kicker text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl tabular-nums">{value}</p>
    </div>
  );
}
