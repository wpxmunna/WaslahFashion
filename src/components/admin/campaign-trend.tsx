"use client";

import { useId, useState } from "react";

export type TrendPoint = { date: string; views: number; clicks: number };

/**
 * Dependency-free area chart for the 14-day view trend. Same inline-SVG
 * approach as `revenue-sparkline`: a 0–100 viewBox scaled by the container.
 */
export function CampaignTrend({ data }: { data: TrendPoint[] }) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.views), 1);
  const stepX = 100 / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: i * stepX,
    // 6% headroom so the peak never touches the top edge.
    y: 100 - (d.views / max) * 94,
    ...d,
  }));

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,100 ${line} 100,100`;

  const active = hover !== null ? points[hover] : null;
  const totalViews = data.reduce((sum, d) => sum + d.views, 0);
  const totalClicks = data.reduce((sum, d) => sum + d.clicks, 0);

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-2xl tabular-nums">
          {(active ? active.views : totalViews).toLocaleString()}
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">views</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {active
            ? `${day(active.date)} · ${active.clicks} click${active.clicks === 1 ? "" : "s"}`
            : `${totalClicks.toLocaleString()} clicks over ${data.length} days`}
        </p>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-40 w-full overflow-visible"
          role="img"
          aria-label={`Campaign views over the last ${data.length} days`}
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
              aria-label={`${day(d.date)}: ${d.views} views, ${d.clicks} clicks`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex justify-between text-[0.7rem] text-muted-foreground">
        <span>{day(data[0].date)}</span>
        <span>{day(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
