"use client";

import { useState } from "react";

import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

export type BarSeries = {
  key: string;
  label: string;
  /** Any CSS colour — a `var(--…)` token keeps it theme-aware. */
  color: string;
};

export type BarPoint = {
  key: string;
  label: string;
  values: Record<string, number>;
};

/**
 * Dependency-free grouped bar chart, drawn as inline SVG on a 0–100 viewBox in
 * the same spirit as `RevenueSparkline`. No charting library is installed and
 * none is warranted for this.
 *
 * Value labels live in HTML rather than inside the SVG, because
 * `preserveAspectRatio="none"` would stretch any text drawn in the viewBox.
 */
export function ReportBarChart({
  data,
  series,
  ariaLabel,
  format = formatPrice,
}: {
  data: BarPoint[];
  series: BarSeries[];
  ariaLabel: string;
  format?: (value: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data in this range.</p>;
  }

  const max = Math.max(
    ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)),
    1,
  );

  const slot = 100 / data.length;
  // Leave a tenth of each slot as a gutter so neighbouring groups stay distinct.
  const gutter = slot * 0.18;
  const barWidth = (slot - gutter) / series.length;

  const active = hover !== null ? data[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-2xl tabular-nums">
          {active
            ? format(active.values[series[0].key] ?? 0)
            : format(data.reduce((sum, d) => sum + (d.values[series[0].key] ?? 0), 0))}
        </p>
        <p className="text-xs text-muted-foreground">
          {active ? active.label : `${data.length} periods`}
        </p>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-44 w-full"
          role="img"
          aria-label={ariaLabel}
        >
          {/* Quartile guides. */}
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {data.map((point, i) =>
            series.map((s, j) => {
              const value = point.values[s.key] ?? 0;
              const height = Math.max((Math.max(value, 0) / max) * 94, value > 0 ? 0.6 : 0);
              const x = i * slot + gutter / 2 + j * barWidth;
              return (
                <rect
                  key={`${point.key}-${s.key}`}
                  x={x}
                  y={100 - height}
                  width={barWidth * 0.86}
                  height={height}
                  fill={s.color}
                  opacity={hover === null || hover === i ? 1 : 0.35}
                />
              );
            }),
          )}
        </svg>

        {/* Invisible hover targets — one column per period. */}
        <div className="absolute inset-0 flex">
          {data.map((point, i) => (
            <button
              key={point.key}
              type="button"
              className="h-full flex-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${point.label}: ${series
                .map((s) => `${s.label} ${format(point.values[s.key] ?? 0)}`)
                .join(", ")}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
        <span>{data[0].label}</span>
        {data.length > 1 && <span>{data[data.length - 1].label}</span>}
      </div>

      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-4">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-muted-foreground">{s.label}</span>
              {active && (
                <span className="tabular-nums">{format(active.values[s.key] ?? 0)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Horizontal share bar for "X% of total" breakdowns. A plain element rather
 * than SVG — it is one rectangle and reads better to a screen reader as text.
 */
export function ShareBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  return (
    <span
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}
      aria-hidden
    >
      <span
        className="block h-full rounded-full bg-primary"
        style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
      />
    </span>
  );
}
