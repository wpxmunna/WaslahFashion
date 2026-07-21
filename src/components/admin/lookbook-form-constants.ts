/**
 * Plain-value exports for `lookbook-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { LookbookFormValues } from "./lookbook-form";

export const emptyLookbookValues: LookbookFormValues = {
  imageUrl: null,
  link: "",
  caption: "",
  isFeatured: false,
  sortOrder: "0",
  isActive: true,
};
