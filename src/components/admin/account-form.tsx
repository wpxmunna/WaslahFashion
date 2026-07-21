"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createAccount, updateAccount } from "@/actions/admin/accounting";
import { initialFormState, type FormState } from "@/actions/types";
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type AccountFormValues = {
  id: number;
  code: string;
  name: string;
  type: string;
  parentId: number | null;
  description: string;
  normalBalance: "DEBIT" | "CREDIT";
  isActive: boolean;
  isSystem: boolean;
};

export type ParentOption = { id: number; code: string; name: string };

const TYPE_OPTIONS = [
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
  { value: "EQUITY", label: "Equity" },
  { value: "REVENUE", label: "Revenue" },
  { value: "EXPENSE", label: "Expense" },
  { value: "COGS", label: "Cost of goods sold" },
];

/**
 * Create/edit an account in a dialog, so the chart of accounts stays a single
 * screen rather than three routes for what is a nine-field form.
 */
export function AccountFormDialog({
  account,
  parents,
  trigger,
}: {
  account?: AccountFormValues;
  parents: ParentOption[];
  /** Must be a single element — Base UI's `render` clones it, there is no `asChild`. */
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = !!account;

  const action = isEdit ? updateAccount.bind(null, account.id) : createAccount;

  // Deliberately not `useActionState`: closing the dialog and refreshing on
  // success has to happen in the submit path, not in an effect reacting to the
  // returned state, which would be a cascading render.
  const [state, setState] = useState<FormState>(initialFormState);
  const [, startTransition] = useTransition();
  const e = state.errors ?? {};

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await action(initialFormState, formData);
      setState(result);
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        setOpen(false);
        router.refresh();
      }
    });
  }

  // A system account's code and type are frozen server-side; the inputs are
  // disabled to match, and a disabled input posts nothing, so the action also
  // falls back to the stored values.
  const locked = account?.isSystem ?? false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="lg">
              <Plus className="size-4" strokeWidth={2} />
              New account
            </Button>
          )
        }
      />

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${account.code}` : "New account"}</DialogTitle>
          <DialogDescription>
            {locked
              ? "This is a system account — its code and type are fixed."
              : "Codes must be unique within the store."}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state.message && !state.ok && <FormMessage state={state} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="code"
              label="Code"
              required
              maxLength={20}
              defaultValue={account?.code ?? ""}
              errors={e.code}
              disabled={locked}
              hint={locked ? "Fixed on system accounts." : undefined}
            />
            <SelectField
              name="type"
              label="Type"
              required
              defaultValue={account?.type ?? "ASSET"}
              errors={e.type}
              options={TYPE_OPTIONS}
              disabled={locked}
            />
          </div>

          <TextField
            name="name"
            label="Name"
            required
            maxLength={255}
            defaultValue={account?.name ?? ""}
            errors={e.name}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="normalBalance"
              label="Normal balance"
              required
              defaultValue={account?.normalBalance ?? "DEBIT"}
              errors={e.normalBalance}
              hint="Debit for assets, expenses and COGS; credit otherwise."
              options={[
                { value: "DEBIT", label: "Debit" },
                { value: "CREDIT", label: "Credit" },
              ]}
            />
            <SelectField
              name="parentId"
              label="Parent account"
              placeholder="None — top level"
              defaultValue={account?.parentId ?? ""}
              errors={e.parentId}
              options={parents
                .filter((p) => p.id !== account?.id)
                .map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))}
            />
          </div>

          <TextareaField
            name="description"
            label="Description"
            rows={2}
            maxLength={2000}
            defaultValue={account?.description ?? ""}
            errors={e.description}
          />

          <CheckboxField
            name="isActive"
            label="Active"
            hint="Inactive accounts cannot be selected on new journal entries."
            defaultChecked={account?.isActive ?? true}
          />

          {/* A disabled select posts nothing, so mirror the frozen values. */}
          {locked && account && (
            <>
              <input type="hidden" name="code" value={account.code} />
              <input type="hidden" name="type" value={account.type} />
            </>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <SubmitButton>{isEdit ? "Save changes" : "Create account"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
