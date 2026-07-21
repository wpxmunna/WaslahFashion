/**
 * Plain-value exports for `supplier-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { SupplierFormValues } from "./supplier-form";

export const emptySupplierValues: SupplierFormValues = {
  name: "",
  code: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "Bangladesh",
  paymentTerms: "30",
  notes: "",
  status: "ACTIVE",
};
