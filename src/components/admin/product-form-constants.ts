/**
 * Plain-value exports for `product-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { ProductFormValues } from "./product-form";

export const emptyProductValues: ProductFormValues = {
  name: "",
  slug: "",
  categoryId: null,
  shortDescription: "",
  description: "",
  price: "",
  salePrice: "",
  costPrice: "",
  sku: "",
  barcode: "",
  stockQuantity: "0",
  lowStockThreshold: "5",
  weight: "",
  status: "ACTIVE",
  isFeatured: false,
  isNew: false,
  metaTitle: "",
  metaDescription: "",
  sizeChartId: null,
};
