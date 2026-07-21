"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addEmployeeSalaryComponent,
  removeEmployeeSalaryComponent,
} from "@/actions/admin/employees";
import { initialFormState } from "@/actions/types";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import {
  DataTable,
  EmptyState,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

export type SalaryStructureRow = {
  id: number;
  componentName: string;
  componentType: "EARNING" | "DEDUCTION";
  calculationType: "FIXED" | "PERCENTAGE";
  amount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export function EmployeeSalaryStructure({
  employeeId,
  rows,
  components,
}: {
  employeeId: number;
  rows: SalaryStructureRow[];
  components: {
    id: number;
    name: string;
    type: "EARNING" | "DEDUCTION";
    calculationType: "FIXED" | "PERCENTAGE";
  }[];
}) {
  const [state, formAction] = useActionState(
    addEmployeeSalaryComponent.bind(null, employeeId),
    initialFormState,
  );
  const [pending, start] = useTransition();
  const e = state.errors ?? {};

  function remove(id: number) {
    start(async () => {
      const r = await removeEmployeeSalaryComponent(id);
      if (r.ok) toast.success(r.message ?? "Removed");
      else toast.error(r.message ?? "Could not remove");
    });
  }

  return (
    <Panel
      title="Salary structure"
      description="Allowances and deductions applied when payroll is processed."
    >
      <div className={cn(pending && "opacity-60")}>
        {rows.length === 0 ? (
          <EmptyState
            title="No components assigned"
            description="Payroll will pay the basic salary alone until a component is added."
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Component</Th>
              <Th>Type</Th>
              <Th align="right">Amount</Th>
              <Th>Effective</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </THead>
            <TBody>
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/40">
                  <Td className="font-medium">{row.componentName}</Td>
                  <Td>
                    <StatusBadge
                      label={row.componentType === "EARNING" ? "Earning" : "Deduction"}
                      tone={row.componentType === "EARNING" ? "success" : "warning"}
                    />
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {row.calculationType === "PERCENTAGE"
                      ? `${row.amount}% of basic`
                      : formatPrice(row.amount)}
                  </Td>
                  <Td className="text-muted-foreground">
                    {row.effectiveFrom} → {row.effectiveTo ?? "open"}
                  </Td>
                  <Td align="right">
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      disabled={pending}
                      aria-label={`Remove ${row.componentName}`}
                      className="inline-flex items-center gap-1 text-xs text-destructive transition-opacity hover:opacity-70"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.8} />
                      Remove
                    </button>
                  </Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        )}

        <form action={formAction} className="border-t border-border p-5">
          {state.message && (
            <div className="mb-4">
              <FormMessage state={state} />
            </div>
          )}

          {components.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No salary components exist yet. Create them under Payroll → Components.
            </p>
          ) : (
            <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SelectField
                name="componentId"
                label="Component"
                required
                placeholder="Choose…"
                options={components.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.type === "EARNING" ? "earning" : "deduction"}, ${
                    c.calculationType === "PERCENTAGE" ? "%" : "fixed"
                  })`,
                }))}
                errors={e.componentId}
                className="lg:col-span-2"
              />
              <TextField
                name="amount"
                label="Amount or %"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue="0"
                errors={e.amount}
              />
              <TextField
                name="effectiveFrom"
                label="Effective from"
                type="date"
                required
                errors={e.effectiveFrom}
              />
              <TextField
                name="effectiveTo"
                label="Effective to"
                type="date"
                errors={e.effectiveTo}
              />
              <div className="lg:col-span-5">
                <SubmitButton>Add component</SubmitButton>
              </div>
            </div>
          )}
        </form>
      </div>
    </Panel>
  );
}
