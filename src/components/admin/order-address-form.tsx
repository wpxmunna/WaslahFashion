"use client";

import { useActionState } from "react";

import { updateOrderAddress } from "@/actions/admin/orders";
import { initialFormState } from "@/actions/types";
import { FormActions, FormMessage, SubmitButton, TextField } from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";

export type OrderAddressValues = {
  shippingName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
};

export function OrderAddressForm({
  orderId,
  values,
}: {
  orderId: number;
  values: OrderAddressValues;
}) {
  const [state, action] = useActionState(updateOrderAddress.bind(null, orderId), initialFormState);
  const e = state.errors ?? {};

  return (
    <Panel title="Delivery details" description="Edit where this order ships.">
      <form action={action}>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {state.message && (
            <div className="sm:col-span-2">
              <FormMessage state={state} />
            </div>
          )}
          <TextField name="shippingName" label="Name" required defaultValue={values.shippingName} errors={e.shippingName} />
          <TextField name="shippingPhone" label="Phone" required defaultValue={values.shippingPhone} errors={e.shippingPhone} />
          <TextField name="shippingLine1" label="Address" required className="sm:col-span-2" defaultValue={values.shippingLine1} errors={e.shippingLine1} />
          <TextField name="shippingLine2" label="Address line 2" className="sm:col-span-2" defaultValue={values.shippingLine2} errors={e.shippingLine2} />
          <TextField name="shippingCity" label="City" required defaultValue={values.shippingCity} errors={e.shippingCity} />
          <TextField name="shippingState" label="District / State" defaultValue={values.shippingState} errors={e.shippingState} />
          <TextField name="shippingPostalCode" label="Postal code" defaultValue={values.shippingPostalCode} errors={e.shippingPostalCode} />
        </div>
        <FormActions>
          <SubmitButton>Save delivery details</SubmitButton>
        </FormActions>
      </form>
    </Panel>
  );
}
