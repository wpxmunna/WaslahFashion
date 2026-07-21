import "server-only";

import { randomBytes } from "node:crypto";

/**
 * `WAS-20260721-A3F91C` — same shape as the legacy `generateOrderNumber()`.
 *
 * Legacy never checked the generated value against the database; the caller
 * retries on the unique-constraint violation instead.
 *
 * Kept apart from `lib/orders.ts` because that module's labels and payment
 * methods are imported by client components, which cannot pull in
 * `server-only` or `node:crypto`.
 */
export function generateOrderNumber(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return `WAS-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
