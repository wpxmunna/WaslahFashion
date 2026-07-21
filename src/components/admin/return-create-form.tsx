"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { createReturn } from "@/actions/admin/returns";
import { initialFormState } from "@/actions/types";
import {
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { DataTable, Panel, TBody, THead, Td, Th } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { REFUND_STATUS_OPTIONS, RETURN_REASONS } from "@/lib/returns";

export type ReturnableLine = {
  orderItemId: number;
  productName: string;
  variantInfo: string | null;
  unitPrice: number;
  ordered: number;
  /** Ordered minus everything already returned on earlier returns. */
  remaining: number;
  isGift: boolean;
};

type Selection = { checked: boolean; quantity: number; restore: boolean };

export function ReturnCreateForm({
  orderId,
  orderNumber,
  orderTotal,
  lines,
}: {
  orderId: number;
  orderNumber: string;
  orderTotal: number;
  lines: ReturnableLine[];
}) {
  const [state, formAction] = useActionState(createReturn, initialFormState);
  const e = state.errors ?? {};

  const [selection, setSelection] = useState<Record<number, Selection>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.orderItemId,
        { checked: false, quantity: l.remaining, restore: !l.isGift },
      ]),
    ),
  );
  const [refundAmount, setRefundAmount] = useState("0");

  const selectedTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const s = selection[line.orderItemId];
        return s?.checked ? sum + line.unitPrice * s.quantity : sum;
      }, 0),
    [lines, selection],
  );

  function patch(id: number, changes: Partial<Selection>) {
    setSelection((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="orderId" value={orderId} />

      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <Panel
        title="Items coming back"
        description={`Order ${orderNumber} · ${formatPrice(orderTotal)}`}
      >
        <DataTable>
          <THead>
            <Th>Return</Th>
            <Th>Product</Th>
            <Th align="right">Unit price</Th>
            <Th align="right">Remaining</Th>
            <Th align="right">Quantity</Th>
            <Th align="center">Restore stock</Th>
          </THead>
          <TBody>
            {lines.map((line) => {
              const s = selection[line.orderItemId];
              const disabled = line.remaining <= 0;
              return (
                <tr key={line.orderItemId} className={disabled ? "opacity-50" : ""}>
                  <Td>
                    <input
                      type="checkbox"
                      name={`include-${line.orderItemId}`}
                      checked={s.checked}
                      disabled={disabled}
                      onChange={(ev) =>
                        patch(line.orderItemId, { checked: ev.target.checked })
                      }
                      aria-label={`Return ${line.productName}`}
                      className="size-4 accent-[var(--primary)]"
                    />
                  </Td>
                  <Td>
                    <span className="block font-medium">{line.productName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {line.variantInfo ?? "No variant"}
                      {line.isGift && " · gift line, never reserved stock"}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(line.unitPrice)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {line.remaining} of {line.ordered}
                  </Td>
                  <Td align="right">
                    <input
                      type="number"
                      name={`qty-${line.orderItemId}`}
                      min={1}
                      max={line.remaining}
                      value={s.quantity}
                      disabled={disabled || !s.checked}
                      onChange={(ev) =>
                        patch(line.orderItemId, {
                          quantity: Math.max(
                            1,
                            Math.min(line.remaining, Number(ev.target.value) || 1),
                          ),
                        })
                      }
                      aria-label={`Quantity returned for ${line.productName}`}
                      className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-right text-sm outline-none focus:border-primary disabled:opacity-50"
                    />
                  </Td>
                  <Td align="center">
                    <input
                      type="checkbox"
                      name={`restore-${line.orderItemId}`}
                      checked={s.restore && !line.isGift}
                      disabled={disabled || !s.checked || line.isGift}
                      onChange={(ev) =>
                        patch(line.orderItemId, { restore: ev.target.checked })
                      }
                      aria-label={`Restore stock for ${line.productName}`}
                      className="size-4 accent-[var(--primary)]"
                    />
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </DataTable>

        <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
          Selected line value:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatPrice(selectedTotal)}
          </span>
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Reason">
          <div className="space-y-4 p-5">
            <SelectField
              name="reason"
              label="Reason"
              required
              defaultValue="CHANGED_MIND"
              errors={e.reason}
              options={RETURN_REASONS.map((r) => ({ value: r.value, label: r.label }))}
            />
            <TextareaField
              name="reasonDetails"
              label="Details"
              rows={4}
              maxLength={2000}
              errors={e.reasonDetails}
              hint="What the customer said, condition on arrival, and so on."
            />
          </div>
        </Panel>

        <Panel title="Refund">
          <div className="space-y-4 p-5">
            <SelectField
              name="refundStatus"
              label="Refund status"
              defaultValue="NOT_REQUIRED"
              errors={e.refundStatus}
              options={REFUND_STATUS_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
            <TextField
              name="refundAmount"
              label="Refund amount"
              type="number"
              step="0.01"
              min="0"
              max={orderTotal}
              value={refundAmount}
              onChange={(ev) => setRefundAmount(ev.target.value)}
              errors={e.refundAmount}
              hint={`Cannot exceed the order total of ${formatPrice(orderTotal)}.`}
            />
            <button
              type="button"
              onClick={() => setRefundAmount(selectedTotal.toFixed(2))}
              className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Use the selected line value ({formatPrice(selectedTotal)})
            </button>
            <TextareaField
              name="adminNotes"
              label="Internal notes"
              rows={3}
              maxLength={2000}
              errors={e.adminNotes}
            />
          </div>
        </Panel>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/returns" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>Record return</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
