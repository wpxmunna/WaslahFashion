"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Print trigger — hidden from the printed output itself via `print:hidden`. */
export function PrintButton({ label = "Print payslip" }: { label?: string }) {
  return (
    <Button variant="outline" size="lg" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" strokeWidth={1.8} />
      {label}
    </Button>
  );
}
