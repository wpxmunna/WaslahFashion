/**
 * Plain-value exports for `slider-form`.
 *
 * These must not live in the `"use client"` module: every export of a client
 * module becomes a client *reference* when imported by a Server Component, so
 * `.map()` throws and property access silently yields undefined.
 */
import type { SliderFormValues } from "./slider-form";

export const emptySliderValues: SliderFormValues = {
  title: "",
  subtitle: "",
  description: "",
  buttonText: "",
  buttonLink: "",
  button2Text: "",
  button2Link: "",
  imageUrl: null,
  textPosition: "LEFT",
  textColor: "#ffffff",
  overlayOpacity: "0.4",
  sortOrder: "0",
  isActive: true,
};
