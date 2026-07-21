"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createPayrollPeriod } from "@/actions/admin/payroll";
import { initialFormState } from "@/actions/types";
import {
  FormActions,
  FormMessage,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";

export function PayrollPeriodForm({
  defaults,
}: {
  defaults: { name: string; startDate: string; endDate: string; payDate: string };
}) {
  const [state, formAction] = useActionState(createPayrollPeriod, initialFormState);
  const e = state.errors ?? {};

  return (
    <form action={formAction}>
      <Panel title="Payroll run">
        <div className="space-y-4 p-5">
          {state.message && <FormMessage state={state} />}

          <TextField
            name="name"
            label="Name"
            required
            hint="Shown on payslips, e.g. “March 2026 salary”."
            defaultValue={defaults.name}
            errors={e.name}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              name="startDate"
              label="Period start"
              type="date"
              required
              defaultValue={defaults.startDate}
              errors={e.startDate}
            />
            <TextField
              name="endDate"
              label="Period end"
              type="date"
              required
              defaultValue={defaults.endDate}
              errors={e.endDate}
            />
            <TextField
              name="payDate"
              label="Pay date"
              type="date"
              defaultValue={defaults.payDate}
              errors={e.payDate}
            />
          </div>
        </div>

        <FormActions>
          <Link href="/admin/payroll" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>Create run</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
