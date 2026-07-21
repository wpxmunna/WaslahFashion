"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { receivePurchaseOrderStock } from "@/actions/admin/purchase-orders";
import { initialFormState } from "@/actions/types";
import { FormActions, FormMessage, SubmitButton } from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

export type ReceiveLine = {
  id: number;
  productName: string;
  productSku: string | null;
  linkedToCatalogue: boolean;
  quantityOrdered: number;
  quantityReceived: number;
};

export function PoReceiveForm({
  purchaseOrderId,
  lines,
}: {
  purchaseOrderId: number;
  lines: ReceiveLine[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    receivePurchaseOrderStock.bind(null, purchaseOrderId),
    initialFormState,
  );

  const [amounts, setAmounts] = useState<Record<number, string>>({});

  // Clearing the inputs is an adjustment to a new action result, so it happens
  // during render rather than in an effect — see "You Might Not Need an Effect".
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.ok) setAmounts({});
  }

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Stock received");
      router.refresh();
    }
  }, [state, router]);

  const outstanding = (line: ReceiveLine) => line.quantityOrdered - line.quantityReceived;
  const anyOutstanding = lines.some((line) => outstanding(line) > 0);

  function receiveAll() {
    setAmounts(
      Object.fromEntries(
        lines
          .filter((line) => outstanding(line) > 0)
          .map((line) => [line.id, String(outstanding(line))]),
      ),
    );
  }

  return (
    <form action={formAction}>
      <Panel
        title="Receive stock"
        description="Enter what has physically arrived. Catalogue-linked lines add to product stock."
        actions={
          anyOutstanding ? (
            <Button type="button" variant="outline" onClick={receiveAll}>
              Receive everything outstanding
            </Button>
          ) : null
        }
      >
        {state.message && !state.ok && (
          <div className="border-b border-border p-4">
            <FormMessage state={state} />
          </div>
        )}

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
                  Ordered
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Received
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Outstanding
                </th>
                <th
                  scope="col"
                  className="w-40 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Receiving now
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line) => {
                const left = outstanding(line);
                return (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <input type="hidden" name="receiveItemId" value={line.id} />
                      <span className="block text-sm font-medium">{line.productName}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {line.productSku ?? "No SKU"}
                        {!line.linkedToCatalogue && " · not a catalogue product"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {line.quantityOrdered}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {line.quantityReceived}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">{left}</td>
                    <td className="px-4 py-3">
                      <input
                        name="receiveQuantity"
                        type="number"
                        min="0"
                        max={left}
                        step="1"
                        disabled={left <= 0}
                        value={amounts[line.id] ?? ""}
                        onChange={(ev) =>
                          setAmounts((prev) => ({ ...prev, [line.id]: ev.target.value }))
                        }
                        aria-label={`Quantity receiving now for ${line.productName}`}
                        placeholder={left > 0 ? "0" : "Complete"}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-primary disabled:opacity-50"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <FormActions>
          {anyOutstanding ? (
            <SubmitButton>Receive stock</SubmitButton>
          ) : (
            <p className="text-sm text-muted-foreground">
              Every line on this order has been received in full.
            </p>
          )}
        </FormActions>
      </Panel>
    </form>
  );
}
