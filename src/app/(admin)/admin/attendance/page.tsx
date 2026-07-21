import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { AttendanceDaily } from "@/components/admin/attendance-daily";
import { AttendanceDateNav } from "@/components/admin/attendance-controls";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Attendance" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** `HH:MM` for a `@db.Time` column stored on the 1970 epoch day. */
function timeLabel(value: Date | null): string | null {
  if (!value) return null;
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(
    value.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireStaff();

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const requested = first(raw.date)?.trim() ?? "";
  const dateStr = DATE_RE.test(requested) ? requested : todayString();
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const employees = await prisma.employee.findMany({
    where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
      attendance: {
        where: { date },
        take: 1,
        select: {
          status: true,
          checkIn: true,
          checkOut: true,
          workHours: true,
          overtimeHours: true,
        },
      },
    },
  });

  const rows = employees.map((e) => {
    const record = e.attendance[0];
    return {
      employeeId: e.id,
      code: e.code,
      name: [e.firstName, e.lastName].filter(Boolean).join(" "),
      department: e.department?.name ?? null,
      status: record?.status ?? null,
      checkIn: record ? timeLabel(record.checkIn) : null,
      checkOut: record ? timeLabel(record.checkOut) : null,
      workHours: record ? toNumber(record.workHours) : 0,
      overtimeHours: record ? toNumber(record.overtimeHours) : 0,
    };
  });

  const present = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const onLeave = rows.filter((r) => r.status === "LEAVE").length;
  const totalHours = rows.reduce((sum, r) => sum + r.workHours, 0);

  return (
    <>
      <PageHeader
        title="Attendance"
        description={`Daily sheet for ${dateStr}.`}
        actions={
          <>
            <AttendanceDateNav date={dateStr} />
            <Link
              href="/admin/attendance/monthly"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <CalendarRange className="size-4" strokeWidth={1.8} />
              Monthly report
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Present" value={String(present)} hint="Includes late arrivals" />
        <StatCard label="Absent" value={String(absent)} />
        <StatCard label="On leave" value={String(onLeave)} />
        <StatCard label="Hours logged" value={totalHours.toFixed(2)} />
      </div>

      <AttendanceDaily date={dateStr} rows={rows} />
    </>
  );
}
