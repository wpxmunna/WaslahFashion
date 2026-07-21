/**
 * Plain-value exports for `po-status-actions`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { PoStatusValue } from "./po-status-actions";

export const PO_STATUS_LABELS: Record<PoStatusValue, string> = {
  DRAFT: "Draft",
  PENDING: "Pending approval",
  APPROVED: "Approved",
  ORDERED: "Ordered",
  PARTIAL: "Partially received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const PO_PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Unpaid",
  PARTIAL: "Part paid",
  PAID: "Paid",
};
