"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "@/actions/admin/employees";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type DepartmentRow = {
  id: number;
  name: string;
  code: string;
  description: string;
  managerId: number | null;
  isActive: boolean;
  employeeCount: number;
};

type Manager = { id: number; name: string };

export function DepartmentManager({
  departments,
  managers,
}: {
  departments: DepartmentRow[];
  managers: Manager[];
}) {
  return (
    <div className="space-y-6">
      <Panel
        title="Departments"
        description="Employees keep their record when a department is removed — they are simply left unassigned."
      >
        {departments.length === 0 ? (
          <EmptyState
            title="No departments yet"
            description="Add one below to start grouping employees."
          />
        ) : (
          <ul className="divide-y divide-border">
            {departments.map((d) => (
              <li key={d.id}>
                <DepartmentEditor department={d} managers={managers} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <NewDepartment managers={managers} />
    </div>
  );
}

function DepartmentEditor({
  department,
  managers,
}: {
  department: DepartmentRow;
  managers: Manager[];
}) {
  const [state, formAction] = useActionState(
    updateDepartment.bind(null, department.id),
    initialFormState,
  );
  const [pending, start] = useTransition();
  const e = state.errors ?? {};

  function remove() {
    start(async () => {
      const r = await deleteDepartment(department.id);
      if (r.ok) toast.success(r.message ?? "Deleted");
      else toast.error(r.message ?? "Could not delete");
    });
  }

  return (
    <form action={formAction} className={cn("p-5", pending && "opacity-60")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{department.name}</h3>
          <StatusBadge status={department.isActive ? "ACTIVE" : "INACTIVE"} />
          <span className="text-xs text-muted-foreground">
            {department.employeeCount} employee
            {department.employeeCount === 1 ? "" : "s"}
          </span>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label={`Delete ${department.name}`}
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          name="name"
          label="Name"
          required
          defaultValue={department.name}
          errors={e.name}
        />
        <TextField
          name="code"
          label="Code"
          defaultValue={department.code}
          errors={e.code}
        />
        <SelectField
          name="managerId"
          label="Manager"
          placeholder="Unassigned"
          options={managers.map((m) => ({ value: m.id, label: m.name }))}
          defaultValue={department.managerId ?? ""}
          errors={e.managerId}
        />
        <TextareaField
          name="description"
          label="Description"
          rows={2}
          defaultValue={department.description}
          errors={e.description}
          className="sm:col-span-2 lg:col-span-4"
        />
        <div className="flex items-end justify-between gap-4 sm:col-span-2 lg:col-span-4">
          <CheckboxField
            name="isActive"
            label="Active"
            defaultChecked={department.isActive}
          />
          <SubmitButton>Save</SubmitButton>
        </div>
      </div>
    </form>
  );
}

function NewDepartment({ managers }: { managers: Manager[] }) {
  const [state, formAction] = useActionState(createDepartment, initialFormState);
  const e = state.errors ?? {};

  return (
    <Panel title="Add a department">
      <form action={formAction} className="p-5">
        {state.message && (
          <div className="mb-4">
            <FormMessage state={state} />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField name="name" label="Name" required errors={e.name} />
          <TextField name="code" label="Code" errors={e.code} />
          <SelectField
            name="managerId"
            label="Manager"
            placeholder="Unassigned"
            options={managers.map((m) => ({ value: m.id, label: m.name }))}
            errors={e.managerId}
          />
          <TextareaField
            name="description"
            label="Description"
            rows={2}
            errors={e.description}
            className="sm:col-span-2 lg:col-span-4"
          />
          <div className="flex items-end justify-between gap-4 sm:col-span-2 lg:col-span-4">
            <CheckboxField name="isActive" label="Active" defaultChecked />
            <SubmitButton>Add department</SubmitButton>
          </div>
        </div>
      </form>
    </Panel>
  );
}
