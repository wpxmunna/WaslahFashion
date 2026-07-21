"use client";

import { Printer } from "lucide-react";

/**
 * The detail page carries `print:` utilities that hide the chrome, so printing
 * the page itself gives the packing-slip view — no separate print route needed.
 */
export function PoPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary print:hidden"
    >
      <Printer className="size-3.5" strokeWidth={1.8} />
      Print
    </button>
  );
}
