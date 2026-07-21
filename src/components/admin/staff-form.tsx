"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createStaff, updateStaff } from "@/actions/admin/staff";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";

export type StaffFormValues = {
  id?: number;
  name: string;
  email: string;
  phone: string;
  role: "ADMIN" | "MANAGER";
  isActive: boolean;
};

export function StaffForm({
  values,
  /** True when the row being edited is the signed-in admin's own account. */
  isSelf = false,
}: {
  values: StaffFormValues;
  isSelf?: boolean;
}) {
  const isEdit = typeof values.id === "number";
  const action = isEdit ? updateStaff.bind(null, values.id as number) : createStaff;

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
          <Panel title="Account">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="name"
                label="Name"
                required
                autoComplete="name"
                defaultValue={values.name}
                errors={e.name}
              />
              <TextField
                name="email"
                label="Email"
                type="email"
                required
                autoComplete="email"
                hint="Used to sign in. Must be unique."
                defaultValue={values.email}
                errors={e.email}
              />
              <TextField
                name="phone"
                label="Phone"
                autoComplete="tel"
                defaultValue={values.phone}
                errors={e.phone}
              />
            </div>
          </Panel>

          <Panel
            title={isEdit ? "Reset password" : "Password"}
            description={
              isEdit
                ? "Leave blank to keep the current password."
                : "At least 8 characters."
            }
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="password"
                label={isEdit ? "New password" : "Password"}
                type="password"
                minLength={8}
                required={!isEdit}
                autoComplete="new-password"
                errors={e.password}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Access">
            <div className="space-y-4 p-5">
              <SelectField
                name="role"
                label="Role"
                required
                defaultValue={values.role}
                errors={e.role}
                hint={
                  isSelf
                    ? "You cannot change your own role."
                    : "Managers are locked out of stores, staff, settings, payroll and accounting."
                }
                options={[
                  { value: "MANAGER", label: "Manager" },
                  { value: "ADMIN", label: "Administrator" },
                ]}
              />
              <div className="border-t border-border pt-4">
                <CheckboxField
                  name="isActive"
                  label="Active"
                  hint={
                    isSelf
                      ? "You cannot deactivate your own account."
                      : "Inactive staff cannot sign in."
                  }
                  defaultChecked={values.isActive}
                />
              </div>
              {isSelf && (
                <p className="rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                  This is your own account. Role changes and deactivation are blocked
                  server-side, as is removing the last active administrator.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/users" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create staff member"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
