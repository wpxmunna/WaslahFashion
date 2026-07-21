import "server-only";

import { randomBytes } from "node:crypto";

/**
 * `JE-20260721-A3F91C` — the journal-entry counterpart of
 * `generateOrderNumber()`.
 *
 * Legacy used `'JE' . date('Ymd') . strtoupper(substr(uniqid(), -4))`, which had
 * no separators and only 16 bits of entropy from a *sequential* source, so two
 * entries created in the same microsecond window collided readily. Six hex
 * characters from `randomBytes` is 24 bits of real entropy; as with order
 * numbers the caller retries on the unique-constraint violation rather than
 * pre-checking the database.
 *
 * Kept in its own plain module (no `"use server"`) because every export of a
 * server-action file must be an async function.
 */
export function generateJournalNumber(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");

  return `JE-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
