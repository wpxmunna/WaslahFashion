"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { changePurchaseOrderStatus } from "@/actions/admin/purchase-orders";
import { Button } from "@/components/ui/button";
import { PO_STATUS_LABELS } from "./po-status-actions-constants";

export type PoStatusValue =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "ORDERED"
  | "PARTIAL"
  | "RECEIVED"
  | "CANCELLED";

/**
 * The moves an operator may make by hand. PARTIAL and RECEIVED are deliberately
 * absent — those are reached only by booking stock in on the receive screen.
 */
const MANUAL_NEXT: Record<PoStatusValue, PoStatusValue[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["ORDERED", "CANCELLED"],
  ORDERED: ["CANCELLED"],
  PARTIAL: ["CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
};

const ACTION_LABELS: Partial<Record<PoStatusValue, string>> = {
  PENDING: "Submit for approval",
  APPROVED: "Approve",
  DRAFT: "Return to draft",
  ORDERED: "Mark as ordered",
  CANCELLED: "Cancel order",
};

export function PoStatusActions({
  id,
  status,
}: {
  id: number;
  status: PoStatusValue;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const next = MANUAL_NEXT[status] ?? [];
  if (next.length === 0) return null;

  function move(target: PoStatusValue) {
    start(async () => {
      const result = await changePurchaseOrderStatus(id, target);
      if (result.ok) {
        toast.success(result.message ?? "Status updated");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not update the status");
      }
    });
  }

  return (
    <>
      {next.map((target) => (
        <Button
          key={target}
          type="button"
          variant={target === "CANCELLED" ? "outline" : "default"}
          disabled={pending}
          onClick={() => move(target)}
          className={target === "CANCELLED" ? "text-destructive" : undefined}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {ACTION_LABELS[target] ?? PO_STATUS_LABELS[target]}
        </Button>
      ))}
    </>
  );
}
