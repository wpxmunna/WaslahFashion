"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createExpense, updateExpense } from "@/actions/admin/expenses";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { SafeImage } from "@/components/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { CURRENCY } from "@/lib/config";
import { EXPENSE_PAYMENT_METHODS, EXPENSE_PAYMENT_STATUSES } from "./expense-form-constants";

export type ExpenseFormValues = {
  id?: number;
  title: string;
  categoryId: number | null;
  description: string;
  amount: string;
  taxAmount: string;
  expenseDate: string;
  paymentMethod: string;
  paymentStatus: string;
  referenceNumber: string;
  vendorName: string;
  notes: string;
  /** Resolved URL of the stored receipt, for the preview. */
  receiptUrl: string | null;
};


function money(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ExpenseForm({
  values,
  categories,
}: {
  values: ExpenseFormValues;
  categories: { id: number; name: string }[];
}) {
  const isEdit = typeof values.id === "number";

  const action = isEdit ? updateExpense.bind(null, values.id as number) : createExpense;

  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  // Preview only — the server recomputes the total from amount + tax and never
  // reads a total off the client.
  const [amount, setAmount] = useState(values.amount);
  const [tax, setTax] = useState(values.taxAmount);
  const total = (Number(amount) || 0) + (Number(tax) || 0);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Details">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="title"
                label="Title"
                required
                maxLength={255}
                defaultValue={values.title}
                errors={e.title}
                className="sm:col-span-2"
              />
              <SelectField
                name="categoryId"
                label="Category"
                placeholder="Uncategorised"
                defaultValue={values.categoryId ?? ""}
                errors={e.categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              <TextField
                name="vendorName"
                label="Vendor"
                maxLength={255}
                defaultValue={values.vendorName}
                errors={e.vendorName}
              />
              <TextareaField
                name="description"
                label="Description"
                rows={4}
                defaultValue={values.description}
                errors={e.description}
                className="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Receipt" description="Optional — attach the scanned receipt.">
            <div className="space-y-4 p-5">
              {values.receiptUrl && (
                <div className="flex items-center gap-4">
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                    <SafeImage
                      src={values.receiptUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      fallbackLabel={values.title}
                    />
                  </span>
                  <CheckboxField
                    name="removeReceipt"
                    label="Remove this receipt"
                    hint="Applied when you save."
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="receiptUrl"
                  label="Receipt URL"
                  placeholder="https://…"
                  errors={e.receiptUrl}
                />
                <div>
                  <label htmlFor="f-receiptFile" className="text-sm font-medium">
                    …or upload a file
                  </label>
                  <input
                    id="f-receiptFile"
                    name="receiptFile"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="mt-1.5 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                  />
                  {isEdit && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Leave both blank to keep the current receipt.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Notes">
            <div className="p-5">
              <TextareaField
                name="notes"
                label="Internal notes"
                rows={3}
                defaultValue={values.notes}
                errors={e.notes}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Amount">
            <div className="space-y-4 p-5">
              <TextField
                name="amount"
                label={`Amount (${CURRENCY.code})`}
                type="number"
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(ev) => setAmount(ev.target.value)}
                errors={e.amount}
              />
              <TextField
                name="taxAmount"
                label="Tax"
                type="number"
                step="0.01"
                min="0"
                value={tax}
                onChange={(ev) => setTax(ev.target.value)}
                errors={e.taxAmount}
              />
              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="font-medium">Total</span>
                <span className="font-display text-xl tabular-nums">
                  {CURRENCY.symbol} {money(total)}
                </span>
              </div>
            </div>
          </Panel>

          <Panel title="Payment">
            <div className="space-y-4 p-5">
              <TextField
                name="expenseDate"
                label="Expense date"
                type="date"
                required
                defaultValue={values.expenseDate}
                errors={e.expenseDate}
              />
              <SelectField
                name="paymentMethod"
                label="Method"
                defaultValue={values.paymentMethod}
                errors={e.paymentMethod}
                options={EXPENSE_PAYMENT_METHODS}
              />
              <SelectField
                name="paymentStatus"
                label="Payment status"
                defaultValue={values.paymentStatus}
                errors={e.paymentStatus}
                options={EXPENSE_PAYMENT_STATUSES}
              />
              <TextField
                name="referenceNumber"
                label="Reference number"
                maxLength={100}
                defaultValue={values.referenceNumber}
                errors={e.referenceNumber}
              />
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/expenses" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create expense"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
