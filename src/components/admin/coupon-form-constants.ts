/**
 * Plain-value exports for `coupon-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { CouponFormValues } from "./coupon-form";

export const emptyCouponValues: CouponFormValues = {
  code: "",
  type: "FIXED",
  value: "",
  minimumAmount: "0",
  maximumDiscount: "",
  giftProductId: null,
  buyQuantity: "1",
  getQuantity: "1",
  usageLimit: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
  usedCount: 0,
};
