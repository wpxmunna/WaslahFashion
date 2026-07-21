"use client";

import { usePathname, useRouter } from "next/navigation";

/** Jump the daily attendance sheet to another date. */
export function AttendanceDateNav({ date }: { date: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Date</span>
      <input
        type="date"
        value={date}
        aria-label="Attendance date"
        onChange={(e) => {
          const next = e.target.value;
          if (next) router.push(`${pathname}?date=${next}`);
        }}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

/** Jump the monthly report to another month. */
export function AttendanceMonthNav({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Month</span>
      <input
        type="month"
        value={month}
        aria-label="Report month"
        onChange={(e) => {
          const next = e.target.value;
          if (next) router.push(`${pathname}?month=${next}`);
        }}
        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
