"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

/* -------------------------------------------------------------------------
   Payroll is full-admin only. Every export in this module gates on
   `requireAdmin()`, mirroring the legacy `admin_role === 'admin'` check that
   locked managers out of the payroll controller.
   ------------------------------------------------------------------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Hours in a nominal working month, used to derive an hourly rate from a
 * monthly basic salary: 26 working days × 8 hours = 208. Legacy instead used
 * `basic / (workingDays × 8)`, which paid a different overtime rate in a
 * 27-working-day month than in a 25-day one for the same employee. A fixed
 * divisor keeps the rate stable across periods.
 */
const MONTHLY_WORK_HOURS = 208;

/**
 * Overtime premium, carried over from the legacy payroll: overtime hours are
 * paid at 1.5× the ordinary hourly rate.
 */
const OVERTIME_MULTIPLIER = 1.5;

function parseDate(value: string): Date | null {
  const s = value.trim();
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Working days between two dates inclusive. Fridays are the weekly holiday in
 * Bangladesh, matching the legacy `if ($dayOfWeek != 5)` rule. There is no
 * public-holiday calendar in the schema, so those are not deducted — mark them
 * as HOLIDAY attendance if they should not count against an employee.
 */
function countWorkingDays(start: Date, end: Date): number {
  if (end < start) return 0;
  let days = 0;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    if (cursor.getUTCDay() !== 5) days++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/* -------------------------------------------------------------------------
   Payroll periods
   ------------------------------------------------------------------------- */

const periodSchema = z.object({
  name: z.string().trim().min(2, "Name this payroll run").max(100),
  startDate: z.string().trim().regex(DATE_RE, "Use the date picker"),
  endDate: z.string().trim().regex(DATE_RE, "Use the date picker"),
  payDate: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().regex(DATE_RE, "Use the date picker").nullable().default(null),
  ),
});

export async function createPayrollPeriod(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = periodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  // Legacy never checked this, and an inverted range made working days zero,
  // which then divided by zero during processing.
  if (d.endDate < d.startDate) {
    return { ok: false, errors: { endDate: ["The end date must follow the start date"] } };
  }
  if (d.payDate && d.payDate < d.startDate) {
    return { ok: false, errors: { payDate: ["The pay date cannot precede the period"] } };
  }

  const period = await prisma.payrollPeriod.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      startDate: parseDate(d.startDate)!,
      endDate: parseDate(d.endDate)!,
      payDate: d.payDate ? parseDate(d.payDate) : null,
      status: "DRAFT",
    },
    select: { id: true },
  });

  revalidatePath("/admin/payroll");
  redirect(`/admin/payroll/${period.id}?created=1`);
}

export async function deletePayrollPeriod(id: number): Promise<FormState> {
  await requireAdmin();

  const period = await prisma.payrollPeriod.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, status: true },
  });
  if (!period) return { ok: false, message: "Payroll period not found." };

  // A paid run is a financial record — it is never removed.
  if (period.status === "PAID" || period.status === "APPROVED") {
    return {
      ok: false,
      message: `A ${period.status.toLowerCase()} payroll run cannot be deleted.`,
    };
  }

  await prisma.payrollPeriod.delete({ where: { id } });
  revalidatePath("/admin/payroll");
  return { ok: true, message: "Payroll period deleted." };
}

/* -------------------------------------------------------------------------
   Processing
   ------------------------------------------------------------------------- */

/**
 * Calculate and write every payroll line for a period.
 *
 * Idempotent by construction: the existing details are deleted and rebuilt
 * inside one transaction, so re-processing a period after correcting salaries
 * or attendance replaces the run rather than duplicating it. (Legacy had no
 * rollback at all and relied on a DRAFT-only guard to avoid duplicates.)
 *
 * Per employee:
 *   workingDays   — calendar days in range excluding Fridays
 *   absenceUnits  — ABSENT days, plus a half day for each HALF_DAY
 *   adjustedBasic — basicSalary / workingDays × (workingDays − absenceUnits)
 *   components    — every EmployeeSalaryComponent row overlapping the period;
 *                   FIXED uses its amount, PERCENTAGE takes that percentage of
 *                   the *full* basic salary (not the pro-rated figure)
 *   overtime      — summed overtime hours × (basicSalary / 208) × 1.5
 *   gross         — adjustedBasic + earnings + overtime
 *   net           — gross − deductions
 */
export async function processPayrollPeriod(periodId: number): Promise<FormState> {
  const admin = await requireAdmin();

  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, storeId: DEFAULT_STORE_ID },
    select: { id: true, status: true, startDate: true, endDate: true },
  });
  if (!period) return { ok: false, message: "Payroll period not found." };

  if (period.status !== "DRAFT" && period.status !== "PROCESSING") {
    return {
      ok: false,
      message: `This run is ${period.status.toLowerCase()} and can no longer be processed.`,
    };
  }

  const workingDays = countWorkingDays(period.startDate, period.endDate);
  if (workingDays === 0) {
    return { ok: false, message: "That period contains no working days." };
  }

  const employees = await prisma.employee.findMany({
    where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
    orderBy: { code: "asc" },
    select: {
      id: true,
      basicSalary: true,
      bankAccount: true,
      mobileBanking: true,
      salaryStructure: {
        // Components effective at any point inside the period. Legacy compared
        // against CURDATE(), so re-running an old period silently applied
        // today's salary structure.
        where: {
          effectiveFrom: { lte: period.endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
        },
        select: {
          amount: true,
          component: {
            select: { id: true, name: true, type: true, calculationType: true },
          },
        },
      },
    },
  });

  if (employees.length === 0) {
    return { ok: false, message: "There are no active employees to pay." };
  }

  // One grouped query rather than the legacy per-employee N+1.
  const attendance = await prisma.attendance.groupBy({
    by: ["employeeId", "status"],
    where: {
      storeId: DEFAULT_STORE_ID,
      date: { gte: period.startDate, lte: period.endDate },
      employeeId: { in: employees.map((e) => e.id) },
    },
    _count: { _all: true },
    _sum: { overtimeHours: true },
  });

  type Tally = {
    present: number;
    absent: number;
    leave: number;
    half: number;
    overtime: number;
  };
  const tallies = new Map<number, Tally>();
  for (const row of attendance) {
    const t = tallies.get(row.employeeId) ?? {
      present: 0,
      absent: 0,
      leave: 0,
      half: 0,
      overtime: 0,
    };
    const n = row._count._all;
    // A late arrival is still a day worked.
    if (row.status === "PRESENT" || row.status === "LATE") t.present += n;
    else if (row.status === "HALF_DAY") {
      t.half += n;
      t.present += n;
    } else if (row.status === "ABSENT") t.absent += n;
    else if (row.status === "LEAVE") t.leave += n;
    t.overtime += toNumber(row._sum.overtimeHours);
    tallies.set(row.employeeId, t);
  }

  type Line = {
    employeeId: number;
    basicSalary: number;
    workingDays: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    overtimeHours: number;
    overtimeAmount: number;
    grossEarnings: number;
    totalDeductions: number;
    netSalary: number;
    paymentMethod: "BANK" | "MOBILE_BANKING" | "CASH";
    components: {
      componentId: number;
      componentName: string;
      componentType: "EARNING" | "DEDUCTION";
      amount: number;
    }[];
  };

  const lines: Line[] = employees.map((employee) => {
    const t = tallies.get(employee.id) ?? {
      present: 0,
      absent: 0,
      leave: 0,
      half: 0,
      overtime: 0,
    };

    const basicSalary = toNumber(employee.basicSalary);
    const perDay = basicSalary / workingDays;

    // Approved leave is paid; a half day costs half a day's pay. Legacy read
    // half days from the database and then never used them, so a half day was
    // paid in full.
    const absenceUnits = t.absent + t.half * 0.5;
    const paidDays = Math.max(0, workingDays - absenceUnits);
    const adjustedBasic = perDay * paidDays;

    let earnings = 0;
    let deductions = 0;
    const components: Line["components"] = [];

    for (const row of employee.salaryStructure) {
      const amount =
        row.component.calculationType === "PERCENTAGE"
          ? (basicSalary * toNumber(row.amount)) / 100
          : toNumber(row.amount);

      const rounded = round2(amount);
      if (row.component.type === "EARNING") earnings += rounded;
      else deductions += rounded;

      components.push({
        // Snapshot name and type: components are editable, and a payslip
        // reissued next year must still read the way it did when it was paid.
        componentId: row.component.id,
        componentName: row.component.name,
        componentType: row.component.type,
        amount: rounded,
      });
    }

    const hourlyRate = basicSalary / MONTHLY_WORK_HOURS;
    const overtimeAmount = round2(t.overtime * hourlyRate * OVERTIME_MULTIPLIER);

    const grossEarnings = round2(adjustedBasic + earnings + overtimeAmount);
    const totalDeductions = round2(deductions);
    const netSalary = round2(grossEarnings - totalDeductions);

    return {
      employeeId: employee.id,
      basicSalary: round2(basicSalary),
      workingDays,
      presentDays: t.present,
      absentDays: t.absent,
      leaveDays: t.leave,
      overtimeHours: round2(t.overtime),
      overtimeAmount,
      grossEarnings,
      totalDeductions,
      netSalary,
      paymentMethod: employee.bankAccount
        ? ("BANK" as const)
        : employee.mobileBanking
          ? ("MOBILE_BANKING" as const)
          : ("CASH" as const),
      components,
    };
  });

  const totals = lines.reduce(
    (acc, line) => ({
      gross: acc.gross + line.grossEarnings,
      deductions: acc.deductions + line.totalDeductions,
      net: acc.net + line.netSalary,
    }),
    { gross: 0, deductions: 0, net: 0 },
  );

  await prisma.$transaction(
    async (tx) => {
      // Cascades to PayrollDetailComponent, so no orphan snapshot rows.
      await tx.payrollDetail.deleteMany({ where: { payrollPeriodId: periodId } });

      for (const line of lines) {
        await tx.payrollDetail.create({
          data: {
            payrollPeriodId: periodId,
            employeeId: line.employeeId,
            basicSalary: line.basicSalary,
            workingDays: line.workingDays,
            presentDays: line.presentDays,
            absentDays: line.absentDays,
            leaveDays: line.leaveDays,
            overtimeHours: line.overtimeHours,
            overtimeAmount: line.overtimeAmount,
            grossEarnings: line.grossEarnings,
            totalDeductions: line.totalDeductions,
            netSalary: line.netSalary,
            paymentMethod: line.paymentMethod,
            paymentStatus: "PENDING",
            components: {
              create: line.components.map((c) => ({
                componentId: c.componentId,
                componentName: c.componentName,
                componentType: c.componentType,
                amount: c.amount,
              })),
            },
          },
        });
      }

      await tx.payrollPeriod.update({
        where: { id: periodId },
        data: {
          status: "PROCESSING",
          totalEmployees: lines.length,
          totalGross: round2(totals.gross),
          totalDeductions: round2(totals.deductions),
          totalNet: round2(totals.net),
          processedById: admin.id,
          processedAt: new Date(),
        },
      });
    },
    { timeout: 30_000 },
  );

  revalidatePath("/admin/payroll");
  revalidatePath(`/admin/payroll/${periodId}`);
  return {
    ok: true,
    message: `Processed ${lines.length} employee${lines.length === 1 ? "" : "s"}.`,
  };
}

/* -------------------------------------------------------------------------
   Status transitions — strictly one-way: DRAFT → PROCESSING → APPROVED → PAID
   ------------------------------------------------------------------------- */

export async function approvePayrollPeriod(periodId: number): Promise<FormState> {
  const admin = await requireAdmin();

  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, storeId: DEFAULT_STORE_ID },
    select: { id: true, status: true, _count: { select: { details: true } } },
  });
  if (!period) return { ok: false, message: "Payroll period not found." };

  if (period.status !== "PROCESSING") {
    return {
      ok: false,
      message: "Only a processed payroll run can be approved.",
    };
  }
  if (period._count.details === 0) {
    return { ok: false, message: "There is nothing to approve — process the run first." };
  }

  await prisma.payrollPeriod.update({
    where: { id: periodId },
    data: { status: "APPROVED", approvedById: admin.id, approvedAt: new Date() },
  });

  revalidatePath("/admin/payroll");
  revalidatePath(`/admin/payroll/${periodId}`);
  return { ok: true, message: "Payroll approved." };
}

export async function markPayrollPaid(periodId: number): Promise<FormState> {
  await requireAdmin();

  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, storeId: DEFAULT_STORE_ID },
    select: { id: true, status: true },
  });
  if (!period) return { ok: false, message: "Payroll period not found." };

  if (period.status !== "APPROVED") {
    return { ok: false, message: "Only an approved payroll run can be marked paid." };
  }

  const paidAt = new Date();

  await prisma.$transaction([
    prisma.payrollDetail.updateMany({
      where: { payrollPeriodId: periodId },
      data: { paymentStatus: "PAID", paidAt },
    }),
    prisma.payrollPeriod.update({
      where: { id: periodId },
      data: { status: "PAID" },
    }),
  ]);

  revalidatePath("/admin/payroll");
  revalidatePath(`/admin/payroll/${periodId}`);
  return { ok: true, message: "Payroll marked as paid." };
}

export async function cancelPayrollPeriod(periodId: number): Promise<FormState> {
  await requireAdmin();

  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, storeId: DEFAULT_STORE_ID },
    select: { id: true, status: true },
  });
  if (!period) return { ok: false, message: "Payroll period not found." };

  if (period.status === "PAID") {
    return { ok: false, message: "A paid payroll run cannot be cancelled." };
  }
  if (period.status === "CANCELLED") {
    return { ok: false, message: "This run is already cancelled." };
  }

  await prisma.payrollPeriod.update({
    where: { id: periodId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/admin/payroll");
  revalidatePath(`/admin/payroll/${periodId}`);
  return { ok: true, message: "Payroll run cancelled." };
}

/* -------------------------------------------------------------------------
   Salary components
   ------------------------------------------------------------------------- */

const componentSchema = z.object({
  name: z.string().trim().min(2, "Enter a component name").max(100),
  type: z.enum(["EARNING", "DEDUCTION"]),
  calculationType: z.enum(["FIXED", "PERCENTAGE"]).default("FIXED"),
  defaultAmount: z.coerce.number().min(0, "Amount cannot be negative").default(0),
  percentageOf: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(50).nullable().default(null),
  ),
  isTaxable: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

function readComponent(formData: FormData) {
  const checked = (name: string) => {
    const v = formData.get(name);
    return v === "on" || v === "true" || v === "1";
  };
  return componentSchema.safeParse({
    ...Object.fromEntries(formData),
    isTaxable: checked("isTaxable"),
    isActive: checked("isActive"),
  });
}

export async function createSalaryComponent(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = readComponent(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  if (d.calculationType === "PERCENTAGE" && d.defaultAmount > 100) {
    return { ok: false, errors: { defaultAmount: ["A percentage cannot exceed 100"] } };
  }

  await prisma.salaryComponent.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      type: d.type,
      calculationType: d.calculationType,
      defaultAmount: d.defaultAmount,
      percentageOf: d.calculationType === "PERCENTAGE" ? (d.percentageOf ?? "basic") : null,
      isTaxable: d.isTaxable,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/payroll/components");
  return { ok: true, message: "Salary component created." };
}

export async function updateSalaryComponent(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const existing = await prisma.salaryComponent.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "Salary component not found." };

  const parsed = readComponent(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  if (d.calculationType === "PERCENTAGE" && d.defaultAmount > 100) {
    return { ok: false, errors: { defaultAmount: ["A percentage cannot exceed 100"] } };
  }

  await prisma.salaryComponent.update({
    where: { id },
    data: {
      name: d.name,
      type: d.type,
      calculationType: d.calculationType,
      defaultAmount: d.defaultAmount,
      percentageOf: d.calculationType === "PERCENTAGE" ? (d.percentageOf ?? "basic") : null,
      isTaxable: d.isTaxable,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/payroll/components");
  return { ok: true, message: "Salary component saved." };
}

export async function deleteSalaryComponent(id: number): Promise<FormState> {
  await requireAdmin();

  const component = await prisma.salaryComponent.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isActive: true },
  });
  if (!component) return { ok: false, message: "Salary component not found." };

  // Deleting cascades to payroll_detail_components, which would rewrite paid
  // payslips. Deactivate instead once a component has been used.
  const [usedInPayroll, assigned] = await Promise.all([
    prisma.payrollDetailComponent.count({ where: { componentId: id } }),
    prisma.employeeSalaryComponent.count({ where: { componentId: id } }),
  ]);

  if (usedInPayroll > 0 || assigned > 0) {
    await prisma.salaryComponent.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/payroll/components");
    return {
      ok: true,
      message:
        "This component is used on payslips or salary structures, so it was deactivated rather than deleted.",
    };
  }

  await prisma.salaryComponent.delete({ where: { id } });
  revalidatePath("/admin/payroll/components");
  return { ok: true, message: "Salary component deleted." };
}
