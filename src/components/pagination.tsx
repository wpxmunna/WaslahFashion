import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalPages: number;
  /** Current query string without `page`, e.g. `sort=newest&min_price=500`. */
  baseQuery?: string;
  basePath: string;
};

/**
 * Windowed pagination. The legacy helper rendered every page number, which got
 * unusable past a few dozen pages.
 */
export function Pagination({ page, totalPages, baseQuery = "", basePath }: Props) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const query = [baseQuery, p > 1 ? `page=${p}` : ""].filter(Boolean).join("&");
    return query ? `${basePath}?${query}` : basePath;
  };

  const pages: (number | "gap")[] = [];
  const window = 1;

  for (let p = 1; p <= totalPages; p++) {
    const isEdge = p === 1 || p === totalPages;
    const isNear = Math.abs(p - page) <= window;

    if (isEdge || isNear) {
      pages.push(p);
    } else if (pages.at(-1) !== "gap") {
      pages.push("gap");
    }
  }

  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          rel="prev"
          aria-label="Previous page"
          className="grid size-10 place-items-center border border-border transition-colors hover:bg-secondary"
        >
          <ChevronLeft className="size-4" strokeWidth={1.7} />
        </Link>
      ) : (
        <span
          aria-hidden
          className="grid size-10 place-items-center border border-border opacity-35"
        >
          <ChevronLeft className="size-4" strokeWidth={1.7} />
        </span>
      )}

      {pages.map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "grid size-10 place-items-center border text-sm tabular-nums transition-colors",
              p === page
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-secondary",
            )}
          >
            {p}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          rel="next"
          aria-label="Next page"
          className="grid size-10 place-items-center border border-border transition-colors hover:bg-secondary"
        >
          <ChevronRight className="size-4" strokeWidth={1.7} />
        </Link>
      ) : (
        <span
          aria-hidden
          className="grid size-10 place-items-center border border-border opacity-35"
        >
          <ChevronRight className="size-4" strokeWidth={1.7} />
        </span>
      )}
    </nav>
  );
}
