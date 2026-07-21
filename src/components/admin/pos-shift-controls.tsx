"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { closeShift, getShiftCashPosition, recordCashLog } from "@/actions/admin/pos";
import { initialFormState, type FormState } from "@/actions/types";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CURRENCY } from "@/lib/config";
import { formatPrice } from "@/lib/money";

type CashPosition = Awaited<ReturnType<typeof getShiftCashPosition>>;

/** Cash in / cash out / close, for the shift the cashier is currently running. */
export function PosShiftControls({ shiftId }: { shiftId: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CashDialog />
      <CloseShiftDialog shiftId={shiftId} />
    </div>
  );
}

function CashDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FormState>(initialFormState);

  // The action is driven from the form's own submit handler rather than
  // `useActionState`, so the dialog closes in the event that caused it instead
  // of in an effect reacting to the result.
  async function submit(formData: FormData) {
    const result = await recordCashLog(initialFormState, formData);
    if (result.ok) {
      toast.success(result.message ?? "Recorded");
      setState(initialFormState);
      setOpen(false);
      router.refresh();
    } else {
      setState(result);
    }
  }

  const e = state.errors ?? {};

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setState(initialFormState);
      }}
    >
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary">
        <ArrowDownLeft className="size-3.5" strokeWidth={1.8} />
        <ArrowUpRight className="size-3.5" strokeWidth={1.8} />
        Cash in / out
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a cash movement</DialogTitle>
          <DialogDescription>
            Petty cash taken out or a float added mid-shift. Both feed the expected
            drawer total.
          </DialogDescription>
        </DialogHeader>

        <form action={submit} className="space-y-4">
          {state.message && <FormMessage state={state} />}

          <SelectField
            name="type"
            label="Type"
            required
            errors={e.type}
            options={[
              { value: "CASH_IN", label: "Cash in" },
              { value: "CASH_OUT", label: "Cash out" },
              { value: "ADJUSTMENT", label: "Adjustment" },
            ]}
          />
          <TextField
            name="amount"
            label={`Amount (${CURRENCY.code})`}
            type="number"
            step="0.01"
            min="0.01"
            required
            errors={e.amount}
          />
          <TextField
            name="reason"
            label="Reason"
            required
            placeholder="Bank drop, change float, supplier paid in cash…"
            errors={e.reason}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton>Record</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseShiftDialog({ shiftId }: { shiftId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CashPosition>(null);
  const [loading, startLoading] = useTransition();
  const [counted, setCounted] = useState("");
  const [state, setState] = useState<FormState>(initialFormState);

  // The expected figure has to be read when the drawer is counted, not when the
  // page rendered — sales keep landing while the dialog sits closed.
  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      setPosition(await getShiftCashPosition(shiftId));
    });
  }, [open, shiftId]);

  async function submit(formData: FormData) {
    const result = await closeShift(initialFormState, formData);
    if (result.ok) {
      toast.success(result.message ?? "Shift closed");
      setOpen(false);
      router.push("/admin/pos/shifts");
    } else {
      setState(result);
    }
  }

  const expected = position?.expectedCash ?? 0;
  const countedNumber = Number(counted);
  const difference =
    counted.trim() === "" || !Number.isFinite(countedNumber)
      ? null
      : Math.round((countedNumber - expected) * 100) / 100;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setState(initialFormState);
      }}
    >
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary">
        <LogOut className="size-3.5" strokeWidth={1.8} />
        Close shift
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close this shift</DialogTitle>
          <DialogDescription>
            Count the drawer and enter the actual total. The difference is recorded
            against the shift.
          </DialogDescription>
        </DialogHeader>

        {loading && !position ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Working out the expected total…
          </p>
        ) : (
          <form action={submit} className="space-y-4">
            <input type="hidden" name="shiftId" value={shiftId} />

            {state.message && <FormMessage state={state} />}

            <dl className="space-y-1.5 rounded-md border border-border bg-secondary/40 p-4 text-sm">
              <Row label="Opening float" value={position?.openingCash ?? 0} />
              <Row label="Cash sales" value={position?.cashTaken ?? 0} />
              <Row label="Cash in" value={position?.cashIn ?? 0} />
              <Row label="Cash out" value={-(position?.cashOut ?? 0)} />
              <Row label="Cash refunds" value={-(position?.cashRefunds ?? 0)} />
              <div className="flex justify-between border-t border-border pt-1.5 font-medium">
                <dt>Expected in drawer</dt>
                <dd className="tabular-nums">{formatPrice(expected)}</dd>
              </div>
            </dl>

            <TextField
              name="actualCash"
              label={`Counted cash (${CURRENCY.code})`}
              type="number"
              step="0.01"
              min="0"
              required
              value={counted}
              onChange={(event) => setCounted(event.target.value)}
              errors={state.errors?.actualCash}
            />

            {difference !== null && (
              <p
                className={
                  difference === 0
                    ? "text-sm text-muted-foreground"
                    : "text-sm font-medium text-destructive"
                }
              >
                {difference === 0
                  ? "Drawer balances exactly."
                  : `${difference > 0 ? "Over" : "Short"} by ${formatPrice(Math.abs(difference))}.`}
              </p>
            )}

            <TextareaField
              name="notes"
              label="Notes"
              rows={2}
              placeholder="Anything that explains a discrepancy."
              errors={state.errors?.notes}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>Close shift</SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatPrice(value)}</dd>
    </div>
  );
}
