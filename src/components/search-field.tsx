"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** `onBrand` styles the field for the deep-green header bar. */
export function SearchField({
  className,
  onBrand = false,
}: {
  className?: string;
  onBrand?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <div className="relative">
        <Search
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2",
            onBrand ? "text-current opacity-70" : "text-muted-foreground",
          )}
          strokeWidth={1.7}
        />
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search"
          aria-label="Search products"
          className={cn(
            "h-10 w-44 rounded-md pl-9 pr-3 text-sm outline-none transition-[width,background-color,border-color] focus:w-60",
            onBrand
              ? "border border-white/20 bg-white/10 placeholder:text-current/60 focus:border-white/40 focus:bg-white/15"
              : "border border-border bg-background placeholder:text-muted-foreground focus:border-primary",
          )}
        />
      </div>
    </form>
  );
}
