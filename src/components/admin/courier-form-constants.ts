/**
 * Plain-value exports for `courier-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { CourierFormValues } from "./courier-form";

export const emptyCourierValues: CourierFormValues = {
  name: "",
  code: "",
  description: "",
  baseRate: "0",
  perKgRate: "0",
  estimatedDays: "",
  trackingUrl: "",
  isActive: true,
};
