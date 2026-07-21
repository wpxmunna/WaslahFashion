/**
 * Plain-value exports for `store-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { StoreFormValues } from "./store-form";

export const emptyStoreValues: StoreFormValues = {
  name: "",
  slug: "",
  description: "",
  email: "",
  phone: "",
  address: "",
  taxRate: "0",
  isActive: true,
  isDefault: false,
};
