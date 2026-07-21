"use client";

import { useActionState } from "react";

import { updateReturn } from "@/actions/admin/returns";
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
import { formatPrice } from "@/lib/money";
import { REFUND_STATUS_OPTIONS } from "@/lib/returns";

export function ReturnRefundForm({
  returnId,
  refundAmount,
  refundStatus,
  adminNotes,
  orderTotal,
}: {
  returnId: number;
  refundAmount: number;
  refundStatus: string;
  adminNotes: string;
  orderTotal: number;
}) {
  const [state, action] = useActionState(
    updateReturn.bind(null, returnId),
    initialFormState,
  );
  const e = state.errors ?? {};

  return (
    <Panel title="Refund">
      <form action={action}>
        <div className="space-y-4 p-5">
          <SelectField
            name="refundStatus"
            label="Refund status"
            defaultValue={refundStatus}
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
            defaultValue={refundAmount.toFixed(2)}
            errors={e.refundAmount}
            hint={`Cannot exceed the order total of ${formatPrice(orderTotal)}.`}
          />
          <TextareaField
            name="adminNotes"
            label="Internal notes"
            rows={4}
            maxLength={2000}
            defaultValue={adminNotes}
            errors={e.adminNotes}
          />
          <FormMessage state={state} />
        </div>
        <FormActions>
          <SubmitButton>Save return</SubmitButton>
        </FormActions>
      </form>
    </Panel>
  );
}
