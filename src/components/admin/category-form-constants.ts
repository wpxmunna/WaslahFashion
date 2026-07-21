/**
 * Plain-value exports for `category-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { CategoryFormValues } from "./category-form";

export const emptyCategoryValues: CategoryFormValues = {
  name: "",
  slug: "",
  description: "",
  parentId: null,
  icon: "",
  sortOrder: "0",
  isActive: true,
  imageUrl: null,
};
