"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createCustomer } from "@/actions/admin/customers";
import { initialFormState } from "@/actions/types";
import { FormActions, FormMessage, SubmitButton, TextField } from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";

export function CustomerForm() {
  const [state, action] = useActionState(createCustomer, initialFormState);
  const e = state.errors ?? {};

  return (
    <form action={action} className="max-w-2xl space-y-6">
      {state.message && <FormMessage state={state} />}
      <Panel title="Customer" description="Name is required; phone and email are optional.">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <TextField name="name" label="Name" required className="sm:col-span-2" errors={e.name} />
          <TextField name="phone" label="Phone" type="tel" errors={e.phone} />
          <TextField
            name="email"
            label="Email (optional)"
            type="email"
            hint="Leave blank for a WhatsApp/Facebook customer with no email."
            errors={e.email}
          />
        </div>
        <FormActions>
          <Link href="/admin/customers" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>Create customer</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
