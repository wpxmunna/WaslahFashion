"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import type { FormState } from "@/actions/types";

/* -------------------------------------------------------------------------
   Time / date helpers.

   `attendance.date` is a `@db.Date` column and `check_in` / `check_out` are
   `@db.Time` columns. Prisma surfaces both as `DateTime`, so dates are stored
   at UTC midnight and times are stored on the 1970-01-01 UTC epoch day. Every
   read and write here goes through these helpers so the two never drift.
   ------------------------------------------------------------------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Anything past this counts as a late arrival — carried over from legacy. */
const LATE_AFTER_MINUTES = 9 * 60 + 30; // 09:30

/** A standard paid day. Anything beyond this on one day is overtime. */
const STANDARD_DAY_HOURS = 8;

function parseDate(value: string): Date | null {
  const s = value.trim();
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTime(value: string | null | undefined): Date | null {
  const s = (value ?? "").trim();
  if (!TIME_RE.test(s)) return null;
  return new Date(`1970-01-01T${s}:00.000Z`);
}

/** Minutes past midnight for a stored `@db.Time` value. */
function minutesOf(time: Date): number {
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

/** Local wall-clock `HH:MM` on the server, used as the default punch time. */
function nowTimeString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Worked hours as a decimal (e.g. 8.5) plus the overtime beyond a standard day.
 * A check-out earlier than the check-in is treated as an overnight shift.
 */
function computeHours(checkIn: Date | null, checkOut: Date | null) {
  if (!checkIn || !checkOut) return { workHours: 0, overtimeHours: 0 };

  let minutes = minutesOf(checkOut) - minutesOf(checkIn);
  if (minutes < 0) minutes += 24 * 60; // shift ran past midnight

  const workHours = round2(minutes / 60);
  const overtimeHours = round2(Math.max(0, workHours - STANDARD_DAY_HOURS));
  return { workHours, overtimeHours };
}

async function employeeInStore(employeeId: number) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  return Boolean(employee);
}

function revalidate() {
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/attendance/monthly");
}

/* -------------------------------------------------------------------------
   Actions
   ------------------------------------------------------------------------- */

const statusEnum = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "LEAVE",
  "HOLIDAY",
]);

/**
 * Record an arrival. Upserts on the `(employeeId, date)` unique constraint so
 * correcting a punch updates the row instead of throwing.
 */
export async function checkInEmployee(
  employeeId: number,
  dateStr: string,
  timeStr?: string,
): Promise<FormState> {
  await requireStaff();

  const date = parseDate(dateStr);
  if (!date) return { ok: false, message: "Invalid date." };
  if (!(await employeeInStore(employeeId))) {
    return { ok: false, message: "Employee not found." };
  }

  const checkIn = parseTime(timeStr ?? nowTimeString());
  if (!checkIn) return { ok: false, message: "Invalid check-in time." };

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
    select: { checkOut: true },
  });

  const status = minutesOf(checkIn) > LATE_AFTER_MINUTES ? "LATE" : "PRESENT";
  const hours = computeHours(checkIn, existing?.checkOut ?? null);

  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: {
      storeId: DEFAULT_STORE_ID,
      employeeId,
      date,
      checkIn,
      status,
      workHours: hours.workHours,
      overtimeHours: hours.overtimeHours,
    },
    update: {
      checkIn,
      status,
      workHours: hours.workHours,
      overtimeHours: hours.overtimeHours,
    },
  });

  revalidate();
  return { ok: true, message: "Checked in." };
}

/** Record a departure and recompute the day's hours server-side. */
export async function checkOutEmployee(
  employeeId: number,
  dateStr: string,
  timeStr?: string,
): Promise<FormState> {
  await requireStaff();

  const date = parseDate(dateStr);
  if (!date) return { ok: false, message: "Invalid date." };

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
    select: { id: true, checkIn: true, storeId: true },
  });
  if (!existing || existing.storeId !== DEFAULT_STORE_ID) {
    return { ok: false, message: "Check in first — there is no record for that day." };
  }
  if (!existing.checkIn) {
    return { ok: false, message: "Check in first — no arrival time is recorded." };
  }

  const checkOut = parseTime(timeStr ?? nowTimeString());
  if (!checkOut) return { ok: false, message: "Invalid check-out time." };

  const hours = computeHours(existing.checkIn, checkOut);

  await prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut,
      workHours: hours.workHours,
      overtimeHours: hours.overtimeHours,
    },
  });

  revalidate();
  return { ok: true, message: `Checked out — ${hours.workHours}h recorded.` };
}

/**
 * Mark a day with an explicit status. Non-working statuses clear any punch
 * times and zero the hours, so a day flipped to LEAVE cannot keep paying
 * overtime from an earlier mistaken check-in.
 */
export async function setAttendanceStatus(
  employeeId: number,
  dateStr: string,
  status: string,
): Promise<FormState> {
  await requireStaff();

  const date = parseDate(dateStr);
  if (!date) return { ok: false, message: "Invalid date." };

  const parsedStatus = statusEnum.safeParse(status);
  if (!parsedStatus.success) return { ok: false, message: "Unknown attendance status." };

  if (!(await employeeInStore(employeeId))) {
    return { ok: false, message: "Employee not found." };
  }

  const worked = parsedStatus.data === "PRESENT" || parsedStatus.data === "LATE" ||
    parsedStatus.data === "HALF_DAY";

  const data = worked
    ? { status: parsedStatus.data }
    : {
        status: parsedStatus.data,
        checkIn: null,
        checkOut: null,
        workHours: 0,
        overtimeHours: 0,
      };

  await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: { storeId: DEFAULT_STORE_ID, employeeId, date, ...data },
    update: data,
  });

  revalidate();
  return { ok: true, message: "Attendance updated." };
}

/** Remove a day's record entirely, returning the employee to "not marked". */
export async function clearAttendance(
  employeeId: number,
  dateStr: string,
): Promise<FormState> {
  await requireStaff();

  const date = parseDate(dateStr);
  if (!date) return { ok: false, message: "Invalid date." };

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
    select: { id: true, storeId: true },
  });
  if (!existing || existing.storeId !== DEFAULT_STORE_ID) {
    return { ok: false, message: "Nothing to clear." };
  }

  await prisma.attendance.delete({ where: { id: existing.id } });

  revalidate();
  return { ok: true, message: "Record cleared." };
}

/**
 * Mark every active employee present for a date, skipping anyone who already
 * has a record. `createMany` with `skipDuplicates` leans on the
 * `(employeeId, date)` unique constraint, so two admins clicking at once
 * cannot double-insert.
 */
export async function markAllPresent(
  dateStr: string,
  timeStr?: string,
): Promise<FormState> {
  await requireStaff();

  const date = parseDate(dateStr);
  if (!date) return { ok: false, message: "Invalid date." };

  const checkIn = timeStr ? parseTime(timeStr) : null;
  if (timeStr && !checkIn) return { ok: false, message: "Invalid check-in time." };

  const employees = await prisma.employee.findMany({
    where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
    select: { id: true },
  });
  if (employees.length === 0) return { ok: false, message: "No active employees." };

  const already = await prisma.attendance.findMany({
    where: { date, employeeId: { in: employees.map((e) => e.id) } },
    select: { employeeId: true },
  });
  const seen = new Set(already.map((a) => a.employeeId));
  const missing = employees.filter((e) => !seen.has(e.id));

  if (missing.length === 0) {
    return { ok: true, message: "Every active employee is already marked for that day." };
  }

  const status = checkIn && minutesOf(checkIn) > LATE_AFTER_MINUTES ? "LATE" : "PRESENT";

  const { count } = await prisma.attendance.createMany({
    data: missing.map((e) => ({
      storeId: DEFAULT_STORE_ID,
      employeeId: e.id,
      date,
      checkIn,
      status,
    })),
    skipDuplicates: true,
  });

  revalidate();
  return {
    ok: true,
    message: `Marked ${count} employee${count === 1 ? "" : "s"} present.`,
  };
}

/**
 * Mark everyone without a record for the date as absent. The mirror image of
 * "mark all present", for closing off a day.
 */
export async function markRemainingAbsent(dateStr: string): Promise<FormState> {
  await requireStaff();

  const date = parseDate(dateStr);
  if (!date) return { ok: false, message: "Invalid date." };

  const employees = await prisma.employee.findMany({
    where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
    select: { id: true },
  });

  const already = await prisma.attendance.findMany({
    where: { date, employeeId: { in: employees.map((e) => e.id) } },
    select: { employeeId: true },
  });
  const seen = new Set(already.map((a) => a.employeeId));
  const missing = employees.filter((e) => !seen.has(e.id));

  if (missing.length === 0) {
    return { ok: true, message: "Every active employee is already marked for that day." };
  }

  const { count } = await prisma.attendance.createMany({
    data: missing.map((e) => ({
      storeId: DEFAULT_STORE_ID,
      employeeId: e.id,
      date,
      status: "ABSENT" as const,
    })),
    skipDuplicates: true,
  });

  revalidate();
  return { ok: true, message: `Marked ${count} employee${count === 1 ? "" : "s"} absent.` };
}
