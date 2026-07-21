"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Invoice toolbar action. Hidden when the page is actually printed. */
export function OrderPrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="gap-1.5">
      <Printer className="size-4" strokeWidth={1.8} />
      Print invoice
    </Button>
  );
}
