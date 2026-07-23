/**
 * Plain constants for inventory. Kept out of the `"use server"` action module,
 * which may only export async functions.
 */
export const ADJUSTMENT_REASONS = [
  "Stock take",
  "Damaged",
  "Lost",
  "Found",
  "Returned to stock",
  "Correction",
  "Other",
] as const;
