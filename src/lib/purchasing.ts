/**
 * Purchasing label maps.
 *
 * These live in a plain module rather than beside the client form that renders
 * them: a Server Component importing a value from a `"use client"` module
 * receives a client *reference*, not the value, so `.map()` on it throws at
 * runtime while typechecking perfectly happily.
 */

export const SUPPLIER_PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Cheque" },
  { value: "MOBILE_BANKING", label: "Mobile banking" },
  { value: "OTHER", label: "Other" },
] as const;

export const SUPPLIER_PAYMENT_METHOD_LABELS: Record<string, string> =
  Object.fromEntries(SUPPLIER_PAYMENT_METHODS.map((m) => [m.value as string, m.label]));
