/**
 * Return display constants shared by server and client components.
 * Server-only return-number generation lives in `lib/return-number.ts`.
 */

export const RETURN_REASONS = [
  { value: "DEFECTIVE", label: "Defective" },
  { value: "DAMAGED", label: "Damaged in transit" },
  { value: "WRONG_ITEM", label: "Wrong item sent" },
  { value: "NOT_AS_DESCRIBED", label: "Not as described" },
  { value: "CHANGED_MIND", label: "Changed mind" },
  { value: "CUSTOMER_REFUSED", label: "Customer refused delivery" },
  { value: "UNDELIVERED", label: "Undelivered" },
  { value: "OTHER", label: "Other" },
] as const;

export const REFUND_STATUS_OPTIONS = [
  { value: "NOT_REQUIRED", label: "No refund required" },
  { value: "PENDING", label: "Refund pending" },
  { value: "COMPLETED", label: "Refund completed" },
] as const;

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  RETURN_REASONS.map((r) => [r.value, r.label]),
);

export function returnReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ").toLowerCase();
}

/** Order states a return can be raised against, as in the legacy screen. */
export const RETURNABLE_ORDER_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED"];
