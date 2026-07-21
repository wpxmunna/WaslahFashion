"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useState } from "react";

export type AdminFilter = {
  name: string;
  label: string;
  options: { value: string; label: string }[];
};

/**
 * Shared list-screen toolbar: a text query plus any number of select filters.
 * Every change resets pagination, since the old offset is meaningless.
 */
export function AdminSearch({
  placeholder = "Search",
  filters = [],
}: {
  placeholder?: string;
  filters?: AdminFilter[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(key);
      else next.set(key, v);
    }
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilters = value !== "" || filters.some((f) => params.get(f.name));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        role="search"
        className="relative min-w-56 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: value.trim() });
        }}
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.7}
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </form>

      {filters.map((filter) => (
        <label key={filter.name} className="contents">
          <span className="sr-only">{filter.label}</span>
          <select
            value={params.get(filter.name) ?? ""}
            onChange={(e) => apply({ [filter.name]: e.target.value })}
            aria-label={filter.label}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {filter.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            apply(
              Object.fromEntries([
                ["q", null],
                ...filters.map((f) => [f.name, null] as const),
              ]),
            );
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-3.5" strokeWidth={1.8} />
          Clear
        </button>
      )}
    </div>
  );
}
