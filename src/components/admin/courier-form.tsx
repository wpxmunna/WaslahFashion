"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createCourier, updateCourier } from "@/actions/admin/couriers";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { CURRENCY } from "@/lib/config";

export type CourierFormValues = {
  id?: number;
  name: string;
  code: string;
  description: string;
  baseRate: string;
  perKgRate: string;
  estimatedDays: string;
  trackingUrl: string;
  isActive: boolean;
};

export function CourierForm({ values }: { values: CourierFormValues }) {
  const isEdit = typeof values.id === "number";
  const action = isEdit ? updateCourier.bind(null, values.id as number) : createCourier;

  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Details">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="name"
                label="Name"
                required
                defaultValue={values.name}
                errors={e.name}
              />
              <TextField
                name="code"
                label="Code"
                required
                hint="Unique per store. Stored uppercase, e.g. PATHAO."
                defaultValue={values.code}
                errors={e.code}
              />
              <TextareaField
                name="description"
                label="Description"
                rows={3}
                defaultValue={values.description}
                errors={e.description}
                className="sm:col-span-2"
              />
              <TextField
                name="trackingUrl"
                label="Tracking URL"
                placeholder="https://merchant.pathao.com/tracking"
                hint="Where customers follow a consignment."
                defaultValue={values.trackingUrl}
                errors={e.trackingUrl}
                className="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Rates">
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <TextField
                name="baseRate"
                label={`Base rate (${CURRENCY.code})`}
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={values.baseRate}
                errors={e.baseRate}
              />
              <TextField
                name="perKgRate"
                label={`Per-kg rate (${CURRENCY.code})`}
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={values.perKgRate}
                errors={e.perKgRate}
              />
              <TextField
                name="estimatedDays"
                label="Estimated days"
                placeholder="2-3"
                defaultValue={values.estimatedDays}
                errors={e.estimatedDays}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Availability">
            <div className="p-5">
              <CheckboxField
                name="isActive"
                label="Active"
                hint="Inactive couriers are hidden from checkout and shipment forms."
                defaultChecked={values.isActive}
              />
            </div>
          </Panel>

          <Panel title="Logo" description="Optional.">
            <div className="space-y-4 p-5">
              <TextField
                name="logoUrl"
                label="Logo URL"
                placeholder="https://…"
                errors={e.logoUrl}
              />
              <div>
                <label htmlFor="f-logoFile" className="text-sm font-medium">
                  …or upload a file
                </label>
                <input
                  id="f-logoFile"
                  name="logoFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="mt-1.5 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/couriers" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create courier"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
