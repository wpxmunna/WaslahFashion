"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BadgeCheck, Ban, Calculator, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  approvePayrollPeriod,
  cancelPayrollPeriod,
  markPayrollPaid,
  processPayrollPeriod,
} from "@/actions/admin/payroll";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/actions/types";

/**
 * Payroll state machine controls. Only the transition legal from the current
 * status is offered; the server re-checks anyway, so a stale page cannot
 * approve a run twice.
 */
export function PayrollPeriodActions({
  periodId,
  status,
  hasDetails,
}: {
  periodId: number;
  status: string;
  hasDetails: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<FormState>) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Done");
        router.refresh();
      } else {
        toast.error(r.message ?? "Something went wrong");
      }
    });
  }

  if (status === "PAID") {
    return (
      <p className="text-sm text-muted-foreground">
        This run is paid and can no longer be changed.
      </p>
    );
  }

  if (status === "CANCELLED") {
    return <p className="text-sm text-muted-foreground">This run was cancelled.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

      {(status === "DRAFT" || status === "PROCESSING") && (
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => processPayrollPeriod(periodId))}
        >
          <Calculator className="size-4" strokeWidth={1.8} />
          {hasDetails ? "Re-process" : "Process payroll"}
        </Button>
      )}

      {status === "PROCESSING" && hasDetails && (
        <Button
          size="lg"
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => approvePayrollPeriod(periodId))}
        >
          <BadgeCheck className="size-4" strokeWidth={1.8} />
          Approve
        </Button>
      )}

      {status === "APPROVED" && (
        <Button
          size="lg"
          disabled={pending}
          onClick={() => run(() => markPayrollPaid(periodId))}
        >
          <Wallet className="size-4" strokeWidth={1.8} />
          Mark as paid
        </Button>
      )}

      <Button
        size="lg"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => cancelPayrollPeriod(periodId))}
      >
        <Ban className="size-4" strokeWidth={1.8} />
        Cancel run
      </Button>
    </div>
  );
}
