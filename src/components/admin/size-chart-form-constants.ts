/**
 * Plain-value exports for `size-chart-form` — must not live in the "use client"
 * module (client-module values become client references in Server Components).
 */
import type { SizeChartFormValues } from "./size-chart-form";

export const emptySizeChartValues: SizeChartFormValues = {
  name: "",
  data: "",
};
