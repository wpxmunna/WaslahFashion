"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SORT_OPTIONS } from "@/lib/config";
import { cn } from "@/lib/utils";

export function ShopToolbar({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const sort = params.get("sort") ?? "newest";
  const minPrice = params.get("min_price") ?? "";
  const maxPrice = params.get("max_price") ?? "";
  const hasPriceFilter = minPrice !== "" || maxPrice !== "";

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any filter change invalidates the current page offset.
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="border-y border-border">
      <div className="flex flex-wrap items-center justify-between gap-4 py-4">
        <p className="text-sm text-muted-foreground tabular-nums">
          {total} {total === 1 ? "piece" : "pieces"}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn(
              "inline-flex items-center gap-2 border px-3.5 py-2 text-sm transition-colors",
              hasPriceFilter
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-secondary",
            )}
          >
            <SlidersHorizontal className="size-3.5" strokeWidth={1.7} />
            Price
            {hasPriceFilter && <span className="kicker">on</span>}
          </button>

          <label className="sr-only" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => apply({ sort: e.target.value })}
            className="h-[2.35rem] border border-border bg-background px-3 text-sm outline-none transition-colors hover:bg-secondary focus:border-foreground"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {open && (
        <form
          className="flex flex-wrap items-end gap-4 border-t border-border py-5"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            apply({
              min_price: String(data.get("min_price") ?? ""),
              max_price: String(data.get("max_price") ?? ""),
            });
          }}
        >
          <div>
            <label htmlFor="min_price" className="kicker text-muted-foreground">
              Min (BDT)
            </label>
            <input
              id="min_price"
              name="min_price"
              type="number"
              min={0}
              step={100}
              defaultValue={minPrice}
              placeholder="0"
              className="mt-1.5 block h-10 w-32 border border-border bg-background px-3 text-sm tabular-nums outline-none focus:border-foreground"
            />
          </div>
          <div>
            <label htmlFor="max_price" className="kicker text-muted-foreground">
              Max (BDT)
            </label>
            <input
              id="max_price"
              name="max_price"
              type="number"
              min={0}
              step={100}
              defaultValue={maxPrice}
              placeholder="Any"
              className="mt-1.5 block h-10 w-32 border border-border bg-background px-3 text-sm tabular-nums outline-none focus:border-foreground"
            />
          </div>

          <Button type="submit" className="h-10 rounded-none">
            Apply
          </Button>

          {hasPriceFilter && (
            <button
              type="button"
              onClick={() => apply({ min_price: null, max_price: null })}
              className="inline-flex h-10 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" strokeWidth={1.7} />
              Clear
            </button>
          )}
        </form>
      )}
    </div>
  );
}
