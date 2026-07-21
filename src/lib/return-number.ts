import "server-only";

import { randomBytes } from "node:crypto";

/**
 * `RET-20260721-A3F91C` — the returns analogue of `generateOrderNumber()`.
 *
 * Legacy produced `RTN202607219F3C` from `uniqid()`, which is derived from the
 * clock and so collides under concurrency; this uses CSPRNG bytes and the
 * caller retries on the unique-constraint violation.
 *
 * Kept out of the `"use server"` action file because every export there must be
 * an async server action, and out of a client-importable module because of
 * `server-only` / `node:crypto`.
 */
export function generateReturnNumber(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return `RET-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
