"use client";

import { useId, useState } from "react";

import { formatPrice } from "@/lib/money";

type Point = { date: string; revenue: number; orders: number };

/**
 * Small dependency-free area chart. Rendered as inline SVG on a 0–100 viewBox
 * so it scales to any container without a charting library.
 */
export function RevenueSparkline({ data }: { data: Point[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.revenue), 1);
  const stepX = 100 / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: i * stepX,
    // Leave 6% headroom so the peak never touches the top edge.
    y: 100 - (d.revenue / max) * 94,
    ...d,
  }));

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,100 ${line} 100,100`;

  const active = hover !== null ? points[hover] : null;
  const total = data.reduce((sum, d) => sum + d.revenue, 0);
  const orders = data.reduce((sum, d) => sum + d.orders, 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-2xl tabular-nums">
          {formatPrice(active ? active.revenue : total)}
        </p>
        <p className="text-xs text-muted-foreground">
          {active
            ? new Date(active.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
              }) + ` · ${active.orders} order${active.orders === 1 ? "" : "s"}`
            : `${orders} order${orders === 1 ? "" : "s"} over ${data.length} days`}
        </p>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-40 w-full overflow-visible"
          role="img"
          aria-label={`Revenue over the last ${data.length} days`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <polygon points={area} fill={`url(#${gradientId})`} />
          <polyline
            points={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {active && (
            <circle
              cx={active.x}
              cy={active.y}
              r="1.4"
              fill="var(--primary)"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Invisible hover targets — one column per day. */}
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <button
              key={d.date}
              type="button"
              className="h-full flex-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${d.date}: ${formatPrice(d.revenue)}, ${d.orders} orders`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
        <span>
          {new Date(data[0].date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </span>
        <span>
          {new Date(data[data.length - 1].date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
    </div>
  );
}
