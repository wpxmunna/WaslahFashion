import "server-only";

import { randomBytes } from "node:crypto";

/**
 * Document-number generators for the purchasing side of the ERP.
 *
 * Legacy built all four of its numbers from `substr(uniqid(), -4)`, which is the
 * low nibbles of a microsecond timestamp — effectively sequential, only 4 chars
 * wide, and never checked against the database. We use 3 random bytes (6 hex
 * chars) instead and let the caller retry on the unique-constraint violation,
 * the same contract as `generateOrderNumber()`.
 *
 * A plain module rather than a `"use server"` one: every export from an action
 * module must be an async server function, and these are neither.
 */

function stamp(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
}

function docNumber(prefix: string, date: Date): string {
  return `${prefix}-${stamp(date)}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** `PO-20260721-A3F91C` — purchase order. */
export function generatePoNumber(date = new Date()): string {
  return docNumber("PO", date);
}

/** `EXP-20260721-A3F91C` — expense. */
export function generateExpenseNumber(date = new Date()): string {
  return docNumber("EXP", date);
}

/** `PAY-20260721-A3F91C` — supplier payment. */
export function generatePaymentNumber(date = new Date()): string {
  return docNumber("PAY", date);
}

/**
 * Run `fn` with a freshly generated number, retrying when the unique index on
 * the number column rejects it. Prisma reports that as P2002.
 */
export async function withUniqueDocNumber<T>(
  generate: () => string,
  fn: (docNumber: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(generate());
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code !== "P2002") throw error;
      lastError = error;
    }
  }

  throw lastError;
}
