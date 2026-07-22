"use client";

import { Ruler } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SizeChart } from "@/lib/size-chart";

export function SizeGuide({ chart }: { chart: SizeChart }) {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex h-11 w-full items-center justify-center gap-2 border border-border px-5 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-secondary">
        <Ruler className="size-4" strokeWidth={1.8} />
        Size guide
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold uppercase tracking-tight">
            Size guide
          </DialogTitle>
          <DialogDescription>Approximate measurements — fit may vary.</DialogDescription>
        </DialogHeader>

        <div className="-mx-1 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {chart.columns.map((col, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/60 last:border-0">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="whitespace-nowrap px-3 py-2 tabular-nums first:font-semibold first:text-foreground"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
