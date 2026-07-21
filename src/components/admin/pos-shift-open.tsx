"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";

import { openShift } from "@/actions/admin/pos";
import { initialFormState } from "@/actions/types";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { CURRENCY } from "@/lib/config";

export type PosTerminalOption = { id: number; name: string; location: string | null };

/**
 * Gate in front of the till. Without an open shift there is nothing to attach a
 * sale or a cash movement to, so the terminal is not rendered at all.
 */
export function PosShiftOpen({ terminals }: { terminals: PosTerminalOption[] }) {
  const [state, formAction] = useActionState(openShift, initialFormState);
  const e = state.errors ?? {};

  return (
    <div className="mx-auto max-w-lg">
      <Panel
        title="Open a shift"
        description="The till stays locked until a shift is open."
      >
        <form action={formAction} className="space-y-5 p-5">
          <div className="flex items-center gap-3 rounded-md bg-secondary/60 p-4 text-sm text-muted-foreground">
            <LockKeyhole className="size-5 shrink-0" strokeWidth={1.6} />
            <p>
              Count the float in the drawer and enter it below. It is the baseline for
              the cash reconciliation when you close the shift.
            </p>
          </div>

          {state.message && <FormMessage state={state} />}

          {terminals.length > 0 ? (
            <SelectField
              name="terminalId"
              label="Terminal"
              required
              defaultValue={String(terminals[0].id)}
              errors={e.terminalId}
              options={terminals.map((t) => ({
                value: t.id,
                label: t.location ? `${t.name} — ${t.location}` : t.name,
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No terminal is registered for this store yet — one named{" "}
              <strong className="text-foreground">Counter 1</strong> will be created
              automatically.
            </p>
          )}

          <TextField
            name="openingCash"
            label={`Opening cash (${CURRENCY.code})`}
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue="0"
            errors={e.openingCash}
            hint="Cash already in the drawer before the first sale."
          />

          <SubmitButton className="w-full">Open shift</SubmitButton>
        </form>
      </Panel>
    </div>
  );
}
