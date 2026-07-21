import { z } from "zod";

import { TAX_RATE } from "./config";

/* -------------------------------------------------------------------------
   Shared POS helpers.

   Deliberately a plain isomorphic module: the terminal is a client component
   and needs the same cart arithmetic, labels and item shapes the server
   actions use. Nothing here may import `server-only` or `node:*`.
   ------------------------------------------------------------------------- */

/**
 * Six upper-case hex characters from the Web Crypto API, which exists in both
 * the browser and Node. `node:crypto` would poison the client bundle.
 */
function randomSuffix(bytes = 3): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function stamp(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
}

/**
 * Document numbers, shaped like `src/lib/order-number.ts`.
 *
 * Legacy built these from `uniqid()` — only four characters of a
 * millisecond-derived counter, so two tills opening a shift in the same
 * millisecond collided. Six random hex characters plus the unique index on the
 * column (callers retry on P2002) makes that a non-issue.
 */
export function generateShiftNumber(date = new Date()): string {
  return `SHIFT-${stamp(date)}-${randomSuffix()}`;
}

export function generateTransactionNumber(date = new Date()): string {
  return `TXN-${stamp(date)}-${randomSuffix()}`;
}

export function generateHoldNumber(date = new Date()): string {
  return `HOLD-${stamp(date)}-${randomSuffix()}`;
}

export function generateRefundNumber(date = new Date()): string {
  return `REF-${stamp(date)}-${randomSuffix()}`;
}

/* ---------------------------------------------------------------- labels -- */

export const POS_PAYMENT_METHODS = ["CASH", "CARD", "MOBILE_BANKING", "MIXED"] as const;
export type PosPaymentMethodValue = (typeof POS_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PosPaymentMethodValue, string> = {
  CASH: "Cash",
  CARD: "Card",
  MOBILE_BANKING: "Mobile banking",
  MIXED: "Mixed",
};

export const POS_REFUND_METHODS = [
  "CASH",
  "CARD",
  "STORE_CREDIT",
  "ORIGINAL_METHOD",
] as const;
export type PosRefundMethodValue = (typeof POS_REFUND_METHODS)[number];

export const REFUND_METHOD_LABELS: Record<PosRefundMethodValue, string> = {
  CASH: "Cash",
  CARD: "Card",
  STORE_CREDIT: "Store credit",
  ORIGINAL_METHOD: "Original method",
};

export const POS_TRANSACTION_STATUSES = ["COMPLETED", "REFUNDED", "VOID"] as const;

export const CASH_LOG_LABELS: Record<string, string> = {
  CASH_IN: "Cash in",
  CASH_OUT: "Cash out",
  ADJUSTMENT: "Adjustment",
};

/* ------------------------------------------------------------ cart maths -- */

/** Round at the money boundary so 0.1 + 0.2 never reaches the database. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type PosCartLine = {
  productId: number;
  variantId?: number | null;
  name: string;
  sku?: string | null;
  variantInfo?: string | null;
  unitPrice: number;
  quantity: number;
  /** Per-line discount, in currency units, applied to the whole line. */
  discount: number;
  /** Stock on hand when the line was added — used for client-side guardrails. */
  stock?: number;
};

export function lineTotal(line: {
  unitPrice: number;
  quantity: number;
  discount: number;
}): number {
  return round2(Math.max(0, line.unitPrice * line.quantity - line.discount));
}

export type PosTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

/**
 * Order totals. Tax is derived from `TAX_RATE` rather than accepted from the
 * client — legacy took `tax_amount` straight off the POST body, so a crafted
 * request could book a negative tax and shrink the total.
 */
export function computeTotals(
  lines: { unitPrice: number; quantity: number; discount: number }[],
  orderDiscount = 0,
): PosTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
  const discount = round2(Math.min(Math.max(0, orderDiscount), subtotal));
  const taxable = Math.max(0, subtotal - discount);
  const tax = round2(taxable * TAX_RATE);
  return { subtotal, discount, tax, total: round2(taxable + tax) };
}

/** Payload the terminal posts to `completeSale`. */
export type CompleteSaleInput = {
  items: {
    productId: number;
    variantId?: number | null;
    quantity: number;
    discount: number;
  }[];
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string;
  orderDiscount: number;
  paymentMethod: PosPaymentMethodValue;
  cashReceived: number;
  cardAmount: number;
  mobileAmount: number;
  notes?: string;
};

/** Payload the refund screen posts to `processRefund`. */
export type ProcessRefundInput = {
  transactionId: number;
  items: { itemId: number; quantity: number }[];
  reason: string;
  refundMethod: PosRefundMethodValue;
  notes?: string;
};

/* ------------------------------------------------------------- held cart -- */

/** Shape stored in `PosHeldOrder.items` (a Json column). */
export const heldItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  variantInfo: z.string().nullable().optional(),
  unitPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1),
  discount: z.coerce.number().min(0).default(0),
});

export type HeldItem = z.infer<typeof heldItemSchema>;

export const heldItemsSchema = z.array(heldItemSchema);

/** Held rows predate validation, so tolerate junk instead of throwing. */
export function parseHeldItems(value: unknown): HeldItem[] {
  const parsed = heldItemsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Shape stored in `PosRefund.items`. */
export const refundedItemSchema = z.object({
  itemId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive().nullable().optional(),
  productName: z.string(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  amount: z.coerce.number().min(0),
});

export type RefundedItem = z.infer<typeof refundedItemSchema>;

export function parseRefundedItems(value: unknown): RefundedItem[] {
  const parsed = z.array(refundedItemSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/* ------------------------------------------------------------------ misc -- */

/** `2026-07-21` → a Date at local midnight, or null for junk input. */
export function parseDateInput(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Exclusive upper bound for a `to` date filter. */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}
