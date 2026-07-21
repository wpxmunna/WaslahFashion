"use client";

import { Printer } from "lucide-react";

/** Print trigger for the receipt page. */
export function PosPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
    >
      <Printer className="size-3.5" strokeWidth={1.8} />
      Print receipt
    </button>
  );
}
