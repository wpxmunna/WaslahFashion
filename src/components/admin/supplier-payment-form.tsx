"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { recordSupplierPayment } from "@/actions/admin/suppliers";
import { initialFormState } from "@/actions/types";
import {
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { SUPPLIER_PAYMENT_METHODS } from "@/lib/purchasing";


export type PayablePo = {
  id: number;
  poNumber: string;
  outstanding: number;
};

/** Today in `YYYY-MM-DD`, for the date input's default. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SupplierPaymentForm({
  supplierId,
  purchaseOrders,
  defaultPurchaseOrderId,
}: {
  supplierId: number;
  purchaseOrders: PayablePo[];
  defaultPurchaseOrderId?: number;
}) {
  const [state, formAction] = useActionState(
    recordSupplierPayment.bind(null, supplierId),
    initialFormState,
  );
  const e = state.errors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful save so a second payment does not
  // accidentally resubmit the first one's figures.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      toast.success(state.message ?? "Payment recorded");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction}>
      <Panel title="Record a payment" description="Optionally settle a specific order.">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {state.message && !state.ok && (
            <div className="sm:col-span-2">
              <FormMessage state={state} />
            </div>
          )}

          <TextField
            name="amount"
            label="Amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            errors={e.amount}
          />
          <TextField
            name="paymentDate"
            label="Payment date"
            type="date"
            required
            defaultValue={today()}
            errors={e.paymentDate}
          />
          <SelectField
            name="paymentMethod"
            label="Method"
            defaultValue="BANK_TRANSFER"
            errors={e.paymentMethod}
            options={SUPPLIER_PAYMENT_METHODS.map((m) => ({ ...m }))}
          />
          <SelectField
            name="purchaseOrderId"
            label="Against purchase order"
            placeholder="Not linked to an order"
            defaultValue={defaultPurchaseOrderId ?? ""}
            errors={e.purchaseOrderId}
            options={purchaseOrders.map((po) => ({
              value: po.id,
              label: `${po.poNumber} — ${po.outstanding.toFixed(2)} outstanding`,
            }))}
          />
          <TextField
            name="referenceNumber"
            label="Reference number"
            maxLength={100}
            hint="Cheque number, transaction id, and so on."
            errors={e.referenceNumber}
          />
          <TextareaField
            name="notes"
            label="Notes"
            rows={2}
            errors={e.notes}
            className="sm:col-span-2"
          />
        </div>

        <FormActions>
          <SubmitButton>Record payment</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
