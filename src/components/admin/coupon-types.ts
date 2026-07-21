/**
 * Coupon type vocabulary shared by the list (server) and the form (client).
 *
 * Kept in its own plain module rather than exported from the client form: a
 * server component importing a value from a `"use client"` file gets a client
 * reference, not the value. It also cannot live in the action module, because
 * every export from a `"use server"` file must be an async function.
 */
export type CouponType =
  | "FIXED"
  | "PERCENTAGE"
  | "FREE_SHIPPING"
  | "GIFT_ITEM"
  | "BUY_X_GET_Y";

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  FIXED: "Fixed amount off",
  PERCENTAGE: "Percentage off",
  FREE_SHIPPING: "Free shipping",
  GIFT_ITEM: "Free gift item",
  BUY_X_GET_Y: "Buy X get Y free",
};

export const COUPON_TYPES = Object.keys(COUPON_TYPE_LABELS) as CouponType[];

/** Plain-English note under the type picker, so the choice is not guesswork. */
export const COUPON_TYPE_HINTS: Record<CouponType, string> = {
  FIXED: "Takes a flat amount off the subtotal, capped at the subtotal itself.",
  PERCENTAGE: "Takes a share of the subtotal off, optionally capped.",
  FREE_SHIPPING: "Waives the delivery charge. No discount value is needed.",
  GIFT_ITEM: "Adds a product to the order for free. The subtotal is unchanged.",
  BUY_X_GET_Y: "Every buy + get units in the cart earn the cheapest get units free.",
};
