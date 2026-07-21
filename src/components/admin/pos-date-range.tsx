"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * `from`/`to` date filter for the POS list screens. Kept separate from
 * `AdminSearch`, which only knows about a query and select filters, so that
 * shared component stays untouched.
 */
export function PosDateRange({
  fromLabel = "From",
  toLabel = "To",
}: {
  fromLabel?: string;
  toLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(
        [
          ["from", fromLabel],
          ["to", toLabel],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {label}
          <input
            type="date"
            value={params.get(key) ?? ""}
            onChange={(event) => apply(key, event.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary"
          />
        </label>
      ))}

      {(params.get("from") || params.get("to")) && (
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.delete("from");
            next.delete("to");
            next.delete("page");
            const qs = next.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
          }}
          className="h-9 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
