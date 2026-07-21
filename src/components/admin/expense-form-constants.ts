/**
 * Plain-value exports for `expense-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { ExpenseFormValues } from "./expense-form";

/** Today as `yyyy-mm-dd`, for date inputs. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const EXPENSE_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "MOBILE_BANKING", label: "Mobile banking" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

export const EXPENSE_PAYMENT_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "PARTIAL", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
];

export const emptyExpenseValues: ExpenseFormValues = {
  title: "",
  categoryId: null,
  description: "",
  amount: "",
  taxAmount: "0",
  expenseDate: today(),
  paymentMethod: "CASH",
  paymentStatus: "PENDING",
  referenceNumber: "",
  vendorName: "",
  notes: "",
  receiptUrl: null,
};
