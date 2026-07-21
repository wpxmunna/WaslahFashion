"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function key(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Presets are computed on the client so they follow the viewer's calendar. */
function presets(): { label: string; start: string; end: string }[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const daysBack = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (n - 1));
    return key(d);
  };

  return [
    { label: "This month", start: key(new Date(y, m, 1)), end: key(new Date(y, m + 1, 0)) },
    {
      label: "Last month",
      start: key(new Date(y, m - 1, 1)),
      end: key(new Date(y, m, 0)),
    },
    { label: "Last 30 days", start: daysBack(30), end: key(now) },
    { label: "This year", start: key(new Date(y, 0, 1)), end: key(new Date(y, 11, 31)) },
  ];
}

export type GranularityOption = "day" | "week" | "month";

/**
 * Date-range control shared by every report screen. It writes `start`, `end`
 * and (optionally) `group` to the query string, so the reports themselves stay
 * server components and every view is linkable and refresh-safe.
 */
export function ReportDateRange({
  start,
  end,
  granularity,
  showGranularity = false,
  exportHref,
}: {
  start: string;
  end: string;
  granularity?: GranularityOption;
  showGranularity?: boolean;
  exportHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) next.set(k, v);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const options = presets();
  const active = options.find((p) => p.start === start && p.end === end);

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-4">
      {/* Uncontrolled, keyed on the current range: a preset or the back button
          changes the URL, which remounts the inputs with the new defaults. That
          avoids mirroring props into state and re-syncing them in an effect.
          A reversed range is swapped server-side by `parseDateRange`. */}
      <form
        key={`${start}:${end}`}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          apply({
            start: String(data.get("start") ?? start),
            end: String(data.get("end") ?? end),
          });
        }}
      >
        <div>
          <label htmlFor="report-start" className="block text-xs font-medium">
            From
          </label>
          <input
            id="report-start"
            name="start"
            type="date"
            defaultValue={start}
            className="mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="report-end" className="block text-xs font-medium">
            To
          </label>
          <input
            id="report-end"
            name="end"
            type="date"
            defaultValue={end}
            className="mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {showGranularity && (
          <div>
            <label htmlFor="report-group" className="block text-xs font-medium">
              Group by
            </label>
            <select
              id="report-group"
              value={granularity ?? "day"}
              onChange={(e) => apply({ group: e.target.value })}
              className="mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        )}

        <Button type="submit" size="lg">
          Apply
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => apply({ start: p.start, end: p.end })}
            aria-pressed={active?.label === p.label}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
              active?.label === p.label
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}

        {exportHref && (
          <a
            href={exportHref}
            className="ml-1 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-secondary"
            download
          >
            Export CSV
          </a>
        )}
      </div>
    </div>
  );
}
