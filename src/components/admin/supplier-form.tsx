"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createSupplier, updateSupplier } from "@/actions/admin/suppliers";
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
import { buttonVariants } from "@/components/ui/button";

export type SupplierFormValues = {
  id?: number;
  name: string;
  code: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  paymentTerms: string;
  notes: string;
  status: "ACTIVE" | "INACTIVE";
};

export function SupplierForm({ values }: { values: SupplierFormValues }) {
  const isEdit = typeof values.id === "number";

  const action = isEdit
    ? updateSupplier.bind(null, values.id as number)
    : createSupplier;

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
                label="Supplier name"
                required
                maxLength={255}
                defaultValue={values.name}
                errors={e.name}
                className="sm:col-span-2"
              />
              <TextField
                name="code"
                label="Supplier code"
                hint="Optional. Must be unique."
                maxLength={50}
                defaultValue={values.code}
                errors={e.code}
              />
              <TextField
                name="contactPerson"
                label="Contact person"
                maxLength={255}
                defaultValue={values.contactPerson}
                errors={e.contactPerson}
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                maxLength={255}
                defaultValue={values.email}
                errors={e.email}
              />
              <TextField
                name="phone"
                label="Phone"
                type="tel"
                maxLength={50}
                defaultValue={values.phone}
                errors={e.phone}
              />
            </div>
          </Panel>

          <Panel title="Address">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextareaField
                name="address"
                label="Street address"
                rows={3}
                defaultValue={values.address}
                errors={e.address}
                className="sm:col-span-2"
              />
              <TextField
                name="city"
                label="City"
                maxLength={100}
                defaultValue={values.city}
                errors={e.city}
              />
              <TextField
                name="country"
                label="Country"
                maxLength={100}
                defaultValue={values.country}
                errors={e.country}
              />
            </div>
          </Panel>

          <Panel title="Notes">
            <div className="p-5">
              <TextareaField
                name="notes"
                label="Internal notes"
                rows={4}
                hint="Only visible to staff."
                defaultValue={values.notes}
                errors={e.notes}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Terms">
            <div className="space-y-4 p-5">
              <SelectField
                name="status"
                label="Status"
                defaultValue={values.status}
                errors={e.status}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <TextField
                name="paymentTerms"
                label="Payment terms (days)"
                type="number"
                min="0"
                max="365"
                hint="Days from invoice to payment due."
                defaultValue={values.paymentTerms}
                errors={e.paymentTerms}
              />
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/suppliers" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create supplier"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
