import Link from "next/link";

import { AttendanceMonthNav } from "@/components/admin/attendance-controls";
import { EmptyState, PageHeader, Panel, TableWrap } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Monthly attendance" };

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** One letter per status, with a legend rendered below the grid. */
const LETTERS: Record<string, string> = {
  PRESENT: "P",
  LATE: "L",
  HALF_DAY: "½",
  ABSENT: "A",
  LEAVE: "V",
  HOLIDAY: "H",
};

const LETTER_CLASS: Record<string, string> = {
  P: "text-emerald-700 dark:text-emerald-300",
  L: "text-amber-700 dark:text-amber-300",
  "½": "text-amber-700 dark:text-amber-300",
  A: "text-destructive",
  V: "text-sky-700 dark:text-sky-300",
  H: "text-muted-foreground",
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MonthlyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireStaff();

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const requested = first(raw.month)?.trim() ?? "";
  const month = MONTH_RE.test(requested) ? requested : currentMonth();

  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0)); // day 0 of next month
  const daysInMonth = end.getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const employees = await prisma.employee.findMany({
    where: { storeId: DEFAULT_STORE_ID, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, firstName: true, lastName: true },
  });

  const records = await prisma.attendance.findMany({
    where: {
      storeId: DEFAULT_STORE_ID,
      date: { gte: start, lte: end },
      employeeId: { in: employees.map((e) => e.id) },
    },
    select: {
      employeeId: true,
      date: true,
      status: true,
      workHours: true,
      overtimeHours: true,
    },
  });

  type Totals = {
    present: number;
    absent: number;
    leave: number;
    late: number;
    hours: number;
    overtime: number;
  };

  const byEmployee = new Map<number, Map<number, string>>();
  const totals = new Map<number, Totals>();

  for (const r of records) {
    const day = r.date.getUTCDate();
    if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, new Map());
    byEmployee.get(r.employeeId)!.set(day, r.status);

    const t =
      totals.get(r.employeeId) ??
      ({ present: 0, absent: 0, leave: 0, late: 0, hours: 0, overtime: 0 } as Totals);

    // A late arrival still counts as a day present, and is also tallied
    // separately so persistent lateness is visible.
    if (r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY") {
      t.present += 1;
    }
    if (r.status === "LATE") t.late += 1;
    if (r.status === "ABSENT") t.absent += 1;
    if (r.status === "LEAVE") t.leave += 1;
    t.hours += toNumber(r.workHours);
    t.overtime += toNumber(r.overtimeHours);

    totals.set(r.employeeId, t);
  }

  const isFriday = (day: number) => new Date(Date.UTC(year, monthIndex - 1, day)).getUTCDay() === 5;

  return (
    <>
      <PageHeader
        title="Monthly attendance"
        description={`Grid for ${month}. Fridays are shaded as the weekly holiday.`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/attendance", label: "Attendance" },
        ]}
        actions={
          <>
            <AttendanceMonthNav month={month} />
            <Link
              href="/admin/attendance"
              className={buttonVariants({ variant: "outline" })}
            >
              Daily sheet
            </Link>
          </>
        }
      />

      <Panel>
        {employees.length === 0 ? (
          <EmptyState
            title="No employees"
            description="Add employees before running an attendance report."
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full border-collapse text-sm">
                <thead className="border-b border-border bg-secondary/40">
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-secondary/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Employee
                    </th>
                    {days.map((d) => (
                      <th
                        key={d}
                        scope="col"
                        className={cn(
                          "px-1 py-2 text-center text-[0.65rem] font-semibold tabular-nums text-muted-foreground",
                          isFriday(d) && "bg-secondary",
                        )}
                      >
                        {d}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2 text-right text-[0.65rem] font-semibold uppercase text-muted-foreground">
                      P
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[0.65rem] font-semibold uppercase text-muted-foreground">
                      A
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[0.65rem] font-semibold uppercase text-muted-foreground">
                      V
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[0.65rem] font-semibold uppercase text-muted-foreground">
                      Late
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[0.65rem] font-semibold uppercase text-muted-foreground">
                      Hrs
                    </th>
                    <th scope="col" className="px-2 py-2 text-right text-[0.65rem] font-semibold uppercase text-muted-foreground">
                      OT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((e) => {
                    const row = byEmployee.get(e.id);
                    const t =
                      totals.get(e.id) ??
                      { present: 0, absent: 0, leave: 0, late: 0, hours: 0, overtime: 0 };
                    return (
                      <tr key={e.id} className="hover:bg-secondary/30">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-2 text-left font-medium"
                        >
                          <Link
                            href={`/admin/employees/${e.id}`}
                            className="link-wipe"
                          >
                            {[e.firstName, e.lastName].filter(Boolean).join(" ")}
                          </Link>
                          <span className="ml-1.5 font-mono text-[0.65rem] text-muted-foreground">
                            {e.code}
                          </span>
                        </th>
                        {days.map((d) => {
                          const status = row?.get(d);
                          const letter = status ? (LETTERS[status] ?? "?") : "";
                          return (
                            <td
                              key={d}
                              title={status ? `${d}: ${status.toLowerCase()}` : undefined}
                              className={cn(
                                "px-1 py-2 text-center text-xs font-semibold",
                                isFriday(d) && "bg-secondary/60",
                                letter ? LETTER_CLASS[letter] : "text-muted-foreground/40",
                              )}
                            >
                              {letter || "·"}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right tabular-nums">{t.present}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{t.absent}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{t.leave}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{t.late}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {t.hours.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {t.overtime.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>

            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <span>
                <strong className="text-emerald-700 dark:text-emerald-300">P</strong> present
              </span>
              <span>
                <strong className="text-amber-700 dark:text-amber-300">L</strong> late
              </span>
              <span>
                <strong className="text-amber-700 dark:text-amber-300">½</strong> half day
              </span>
              <span>
                <strong className="text-destructive">A</strong> absent
              </span>
              <span>
                <strong className="text-sky-700 dark:text-sky-300">V</strong> leave
              </span>
              <span>
                <strong>H</strong> holiday
              </span>
              <span>
                <strong>·</strong> not marked
              </span>
              <span>The P total includes late and half days.</span>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
