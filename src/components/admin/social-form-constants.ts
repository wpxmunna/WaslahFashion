/**
 * Plain-value exports for `social-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { SocialFormValues } from "./social-form";

export const emptySocialValues: SocialFormValues = {
  platform: "",
  name: "",
  url: "",
  icon: "",
  iconStyle: "BRANDS",
  color: "#000000",
  sortOrder: "0",
  isActive: true,
  showInHeader: false,
  showInFooter: true,
  openNewTab: true,
};
