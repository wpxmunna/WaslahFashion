/**
 * Plain-value exports for `staff-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { StaffFormValues } from "./staff-form";

export const emptyStaffValues: StaffFormValues = {
  name: "",
  email: "",
  phone: "",
  role: "MANAGER",
  isActive: true,
};
