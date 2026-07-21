"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { createJournalEntry } from "@/actions/admin/accounting";
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
import { Panel, TableWrap } from "@/components/admin/ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

export type JournalAccountOption = {
  id: number;
  code: string;
  name: string;
  type: string;
};

type Line = {
  uid: number;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
};

const REFERENCE_TYPES = [
  { value: "MANUAL", label: "Manual" },
  { value: "ORDER", label: "Order" },
  { value: "EXPENSE", label: "Expense" },
  { value: "PURCHASE", label: "Purchase" },
  { value: "RETURN", label: "Return" },
  { value: "PAYMENT", label: "Payment" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

function blank(uid: number): Line {
  return { uid, accountId: "", description: "", debit: "", credit: "" };
}

function money(raw: string): number {
  const n = Number(raw.trim() || 0);
  return Number.isFinite(n) ? n : 0;
}

function todayKey(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Dynamic double-entry line editor.
 *
 * Lines post as four parallel repeated fields (`lineAccountId`,
 * `lineDescription`, `lineDebit`, `lineCredit`) which the action reads with
 * `FormData.getAll()`, so no client-side JSON serialisation is involved and the
 * form degrades to an ordinary POST.
 *
 * The running totals here are a convenience only — the action re-validates that
 * debits equal credits, that the total is positive and that no single line
 * carries both a debit and a credit.
 */
export function JournalEntryForm({ accounts }: { accounts: JournalAccountOption[] }) {
  const [state, formAction] = useActionState(createJournalEntry, initialFormState);
  const e = state.errors ?? {};
  const tableId = useId();

  const [lines, setLines] = useState<Line[]>([blank(1), blank(2)]);
  const [nextUid, setNextUid] = useState(3);

  function update(uid: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blank(nextUid)]);
    setNextUid((n) => n + 1);
  }

  function removeLine(uid: number) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.uid !== uid)));
  }

  const totalDebit = lines.reduce((sum, l) => sum + money(l.debit), 0);
  const totalCredit = lines.reduce((sum, l) => sum + money(l.credit), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = difference === 0 && totalDebit > 0;

  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: `${a.code} · ${a.name}`,
  }));

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <Panel title="Entry">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <TextField
            name="entryDate"
            label="Date"
            type="date"
            required
            defaultValue={todayKey()}
            errors={e.entryDate}
          />
          <SelectField
            name="referenceType"
            label="Reference type"
            defaultValue="MANUAL"
            errors={e.referenceType}
            options={REFERENCE_TYPES}
          />
          <TextField
            name="description"
            label="Description"
            required
            maxLength={1000}
            placeholder="e.g. Record October rent"
            errors={e.description}
            className="sm:col-span-2"
          />
          <TextareaField
            name="notes"
            label="Notes"
            rows={2}
            maxLength={2000}
            errors={e.notes}
            className="sm:col-span-2"
          />
        </div>
      </Panel>

      <Panel
        title="Lines"
        description="Every entry needs at least two lines, and debits must equal credits."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="size-3.5" strokeWidth={2} />
            Add line
          </Button>
        }
      >
        <TableWrap>
          <table className="w-full border-collapse" id={tableId}>
            <thead className="border-b border-border bg-secondary/40">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Account
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Debit
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Credit
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line, index) => (
                <tr key={line.uid}>
                  <td className="px-4 py-2">
                    <select
                      name="lineAccountId"
                      value={line.accountId}
                      onChange={(ev) => update(line.uid, { accountId: ev.target.value })}
                      aria-label={`Line ${index + 1} account`}
                      className="h-9 w-56 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    >
                      <option value="">Choose an account…</option>
                      {accountOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      name="lineDescription"
                      value={line.description}
                      maxLength={255}
                      onChange={(ev) =>
                        update(line.uid, { description: ev.target.value })
                      }
                      aria-label={`Line ${index + 1} description`}
                      className="h-9 w-full min-w-40 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      name="lineDebit"
                      step="0.01"
                      min="0"
                      value={line.debit}
                      // A line sits on one side of the ledger only, so entering
                      // a debit clears any credit on the same row.
                      onChange={(ev) =>
                        update(line.uid, {
                          debit: ev.target.value,
                          credit: ev.target.value ? "" : line.credit,
                        })
                      }
                      aria-label={`Line ${index + 1} debit`}
                      className="h-9 w-28 rounded-md border border-border bg-background px-2 text-right text-sm tabular-nums outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      name="lineCredit"
                      step="0.01"
                      min="0"
                      value={line.credit}
                      onChange={(ev) =>
                        update(line.uid, {
                          credit: ev.target.value,
                          debit: ev.target.value ? "" : line.debit,
                        })
                      }
                      aria-label={`Line ${index + 1} credit`}
                      className="h-9 w-28 rounded-md border border-border bg-background px-2 text-right text-sm tabular-nums outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.uid)}
                      disabled={lines.length <= 2}
                      aria-label={`Remove line ${index + 1}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                    >
                      <Trash2 className="size-4" strokeWidth={1.8} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-secondary/40">
              <tr>
                <td className="px-4 py-3 text-sm font-medium" colSpan={2}>
                  Totals
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums">
                  {formatPrice(totalDebit)}
                </td>
                <td className="px-4 py-3 text-right text-sm tabular-nums">
                  {formatPrice(totalCredit)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </TableWrap>

        <div className="border-t border-border px-5 py-4">
          <p
            role="status"
            className={cn(
              "text-sm",
              balanced
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-muted-foreground",
            )}
          >
            {totalDebit === 0 && totalCredit === 0
              ? "Enter the debit and credit amounts."
              : balanced
                ? "Balanced — debits equal credits."
                : `Out of balance by ${formatPrice(Math.abs(difference))}.`}
          </p>
        </div>
      </Panel>

      <Panel>
        <div className="px-5 py-4">
          <CheckboxField
            name="postNow"
            label="Post immediately"
            hint="Posting applies the amounts to each account balance. Leave off to save a draft you can review first."
          />
        </div>
        <FormActions>
          <Link
            href="/admin/accounting/journal"
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
          <SubmitButton>Create entry</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
