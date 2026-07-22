/**
 * Plain-value exports for `po-form`.
 *
 * `emptyPoValues` must not live in the `"use client"` module: the new-PO page is
 * a Server Component and calling a client export from the server throws
 * ("Attempted to call emptyPoValues() from the server"). Types are erased, so
 * importing `PoFormValues` as a type across the boundary is safe.
 */
import type { PoFormValues } from "./po-form";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptyPoValues(supplierId?: number): PoFormValues {
  return {
    supplierId: supplierId ?? null,
    orderDate: today(),
    expectedDate: "",
    status: "DRAFT",
    taxAmount: "0",
    shippingAmount: "0",
    discountAmount: "0",
    notes: "",
    lines: [],
  };
}
