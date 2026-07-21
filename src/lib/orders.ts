/**
 * Order display constants shared by server and client components.
 * Server-only order-number generation lives in `lib/order-number.ts`.
 */

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

export const PAYMENT_METHODS = [
  {
    value: "cod",
    label: "Cash on delivery",
    description: "Pay the courier when your order arrives.",
  },
  {
    value: "bkash",
    label: "bKash",
    description: "Pay now with your bKash wallet.",
  },
  {
    value: "card",
    label: "Card",
    description: "Visa, Mastercard or American Express.",
  },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"];

export function isPaymentMethod(value: string): value is PaymentMethodValue {
  return PAYMENT_METHODS.some((m) => m.value === value);
}
