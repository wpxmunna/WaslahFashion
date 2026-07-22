"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createSizeChart, updateSizeChart } from "@/actions/admin/size-charts";
import { initialFormState } from "@/actions/types";
import {
  FormActions,
  FormMessage,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";

export type SizeChartFormValues = {
  id?: number;
  name: string;
  data: string;
};

export function SizeChartForm({ values }: { values: SizeChartFormValues }) {
  const isEdit = typeof values.id === "number";
  const action = isEdit
    ? updateSizeChart.bind(null, values.id as number)
    : createSizeChart;

  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <Panel
        title="Size chart"
        description="Give it a clear name (e.g. “Half-sleeve Shirt”) so you can pick it on products."
      >
        <div className="space-y-4 p-5">
          <TextField
            name="name"
            label="Name"
            required
            placeholder="Half-sleeve Shirt"
            defaultValue={values.name}
            errors={e.name}
          />
          <TextareaField
            name="data"
            label="Measurements"
            rows={8}
            required
            defaultValue={values.data}
            errors={e.data}
            hint="One row per line; separate cells with commas (or paste from a spreadsheet). The first line is the column headings."
            placeholder={"Size, Chest, Length, Shoulder, Sleeve\nS, 38, 28, 17, 24\nM, 40, 29, 17.5, 24.5\nL, 42, 30, 18, 25"}
          />
        </div>
      </Panel>

      <Panel>
        <FormActions>
          <Link href="/admin/size-charts" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create size chart"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
