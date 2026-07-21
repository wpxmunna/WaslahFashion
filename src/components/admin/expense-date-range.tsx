"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

/**
 * Date-range filter for the expense list.
 *
 * `AdminSearch` only models a query plus select filters, so the range lives in
 * its own control rather than being bolted onto the shared component.
 */
export function ExpenseDateRange() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  function apply(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clear() {
    const next = new URLSearchParams(params.toString());
    next.delete("from");
    next.delete("to");
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const control =
    "h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        From
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => apply("from", e.target.value)}
          className={control}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        To
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => apply("to", e.target.value)}
          className={control}
        />
      </label>

      {(from || to) && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-3.5" strokeWidth={1.8} />
          Clear dates
        </button>
      )}
    </div>
  );
}
