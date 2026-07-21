"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createSalaryComponent,
  deleteSalaryComponent,
  updateSalaryComponent,
} from "@/actions/admin/payroll";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import { EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type SalaryComponentRow = {
  id: number;
  name: string;
  type: "EARNING" | "DEDUCTION";
  calculationType: "FIXED" | "PERCENTAGE";
  defaultAmount: string;
  percentageOf: string;
  isTaxable: boolean;
  isActive: boolean;
  usageCount: number;
};

const TYPES = [
  { value: "EARNING", label: "Earning" },
  { value: "DEDUCTION", label: "Deduction" },
];

const CALCULATIONS = [
  { value: "FIXED", label: "Fixed amount" },
  { value: "PERCENTAGE", label: "Percentage of basic" },
];

export function SalaryComponentManager({ components }: { components: SalaryComponentRow[] }) {
  return (
    <div className="space-y-6">
      <Panel
        title="Salary components"
        description="Percentage components are calculated against the employee's full basic salary."
      >
        {components.length === 0 ? (
          <EmptyState
            title="No components yet"
            description="Add allowances and deductions here, then assign them to employees."
          />
        ) : (
          <ul className="divide-y divide-border">
            {components.map((c) => (
              <li key={c.id}>
                <ComponentEditor component={c} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <NewComponent />
    </div>
  );
}

function Fields({
  values,
  errors,
}: {
  values?: SalaryComponentRow;
  errors: Record<string, string[]>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <TextField
        name="name"
        label="Name"
        required
        defaultValue={values?.name}
        errors={errors.name}
      />
      <SelectField
        name="type"
        label="Type"
        required
        options={TYPES}
        defaultValue={values?.type ?? "EARNING"}
        errors={errors.type}
      />
      <SelectField
        name="calculationType"
        label="Calculation"
        options={CALCULATIONS}
        defaultValue={values?.calculationType ?? "FIXED"}
        errors={errors.calculationType}
      />
      <TextField
        name="defaultAmount"
        label="Default amount or %"
        type="number"
        step="0.01"
        min="0"
        defaultValue={values?.defaultAmount ?? "0"}
        errors={errors.defaultAmount}
      />
      <TextField
        name="percentageOf"
        label="Percentage of"
        hint="Label only — the calculation always uses basic salary."
        defaultValue={values?.percentageOf ?? "basic"}
        errors={errors.percentageOf}
      />
      <div className="flex items-end gap-6 sm:col-span-2 lg:col-span-2">
        <CheckboxField
          name="isTaxable"
          label="Taxable"
          defaultChecked={values?.isTaxable ?? false}
        />
        <CheckboxField
          name="isActive"
          label="Active"
          defaultChecked={values?.isActive ?? true}
        />
      </div>
    </div>
  );
}

function ComponentEditor({ component }: { component: SalaryComponentRow }) {
  const [state, formAction] = useActionState(
    updateSalaryComponent.bind(null, component.id),
    initialFormState,
  );
  const [pending, start] = useTransition();

  function remove() {
    start(async () => {
      const r = await deleteSalaryComponent(component.id);
      if (r.ok) toast.success(r.message ?? "Deleted");
      else toast.error(r.message ?? "Could not delete");
    });
  }

  return (
    <form action={formAction} className={cn("p-5", pending && "opacity-60")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{component.name}</h3>
          <StatusBadge
            label={component.type === "EARNING" ? "Earning" : "Deduction"}
            tone={component.type === "EARNING" ? "success" : "warning"}
          />
          <StatusBadge status={component.isActive ? "ACTIVE" : "INACTIVE"} />
          {component.usageCount > 0 && (
            <span className="text-xs text-muted-foreground">
              Assigned to {component.usageCount} employee
              {component.usageCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label={`Delete ${component.name}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5" strokeWidth={1.8} />
          Delete
        </button>
      </div>

      {state.message && (
        <div className="mb-3">
          <FormMessage state={state} />
        </div>
      )}

      <Fields values={component} errors={state.errors ?? {}} />

      <div className="mt-4 flex justify-end">
        <SubmitButton>Save</SubmitButton>
      </div>
    </form>
  );
}

function NewComponent() {
  const [state, formAction] = useActionState(createSalaryComponent, initialFormState);

  return (
    <Panel title="Add a component">
      <form action={formAction} className="p-5">
        {state.message && (
          <div className="mb-4">
            <FormMessage state={state} />
          </div>
        )}
        <Fields errors={state.errors ?? {}} />
        <div className="mt-4 flex justify-end">
          <SubmitButton>Add component</SubmitButton>
        </div>
      </form>
    </Panel>
  );
}
