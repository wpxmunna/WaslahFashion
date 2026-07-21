"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createStore, updateStore } from "@/actions/admin/stores";
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

export type StoreFormValues = {
  id?: number;
  name: string;
  slug: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  taxRate: string;
  isActive: boolean;
  isDefault: boolean;
};

export function StoreForm({ values }: { values: StoreFormValues }) {
  const isEdit = typeof values.id === "number";
  const action = isEdit ? updateStore.bind(null, values.id as number) : createStore;

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
                name="slug"
                label="URL slug"
                hint="Globally unique. Leave blank to generate from the name."
                defaultValue={values.slug}
                errors={e.slug}
              />
              <TextareaField
                name="description"
                label="Description"
                rows={3}
                defaultValue={values.description}
                errors={e.description}
                className="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Contact">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="email"
                label="Email"
                type="email"
                defaultValue={values.email}
                errors={e.email}
              />
              <TextField
                name="phone"
                label="Phone"
                defaultValue={values.phone}
                errors={e.phone}
              />
              <TextareaField
                name="address"
                label="Address"
                rows={3}
                defaultValue={values.address}
                errors={e.address}
                className="sm:col-span-2"
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Configuration">
            <div className="space-y-4 p-5">
              <TextField
                name="taxRate"
                label="Tax rate (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                defaultValue={values.taxRate}
                errors={e.taxRate}
              />
              <div className="space-y-3 border-t border-border pt-4">
                <CheckboxField
                  name="isActive"
                  label="Active"
                  hint="Inactive stores are hidden from the storefront."
                  defaultChecked={values.isActive}
                />
                <CheckboxField
                  name="isDefault"
                  label="Default store"
                  hint="Setting this clears the flag on every other store."
                  defaultChecked={values.isDefault}
                />
              </div>
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
          <Link href="/admin/stores" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create store"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
