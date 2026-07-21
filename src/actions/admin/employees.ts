"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { resolveImageInput } from "@/lib/admin/upload";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

/* -------------------------------------------------------------------------
   Helpers (not exported — a "use server" module may only export async fns).
   ------------------------------------------------------------------------- */

/** Parse a `yyyy-mm-dd` input into a UTC midnight Date for a `@db.Date` column. */
function toDate(value: FormDataEntryValue | null | undefined): Date | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max).nullable().default(null));

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker");

const optionalDateString = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
    .nullable()
    .default(null),
);

const employeeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Enter an employee code")
    .max(20, "Employee code is too long"),
  firstName: z.string().trim().min(1, "Enter a first name").max(100),
  lastName: optionalText(100),
  email: z.preprocess(
    blankToNull,
    z.email("Enter a valid email address").max(255).nullable().default(null),
  ),
  phone: optionalText(50),
  dateOfBirth: optionalDateString,
  gender: z.preprocess(
    blankToNull,
    z.enum(["MALE", "FEMALE", "OTHER"]).nullable().default(null),
  ),
  nationalId: optionalText(50),
  address: optionalText(2000),
  city: optionalText(100),
  departmentId: z.preprocess(blankToNull, z.coerce.number().int().positive().nullable().default(null)),
  designation: optionalText(100),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]).default("FULL_TIME"),
  hireDate: dateString,
  terminationDate: optionalDateString,
  basicSalary: z.coerce.number().min(0, "Salary cannot be negative").default(0),
  bankName: optionalText(100),
  bankAccount: optionalText(50),
  mobileBanking: optionalText(50),
  emergencyContactName: optionalText(255),
  emergencyContactPhone: optionalText(50),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"]).default("ACTIVE"),
  notes: optionalText(5000),
});

/* -------------------------------------------------------------------------
   Employee code
   ------------------------------------------------------------------------- */

/**
 * Suggest the next free employee code in the `EMP-NNN` series.
 *
 * Legacy derived this from `COUNT(*) + 1`, which produced a duplicate as soon
 * as anyone was deleted. We take the highest numeric suffix instead, and the
 * `@@unique([storeId, code])` constraint is the real backstop.
 */
export async function nextEmployeeCode(): Promise<string> {
  await requireStaff();

  const rows = await prisma.employee.findMany({
    where: { storeId: DEFAULT_STORE_ID },
    select: { code: true },
  });

  let highest = 0;
  for (const row of rows) {
    const m = /^EMP-?(\d+)$/i.exec(row.code.trim());
    if (m) highest = Math.max(highest, Number(m[1]));
  }

  return `EMP-${String(highest + 1).padStart(3, "0")}`;
}

/* -------------------------------------------------------------------------
   Employees
   ------------------------------------------------------------------------- */

async function codeTaken(code: string, excludeId?: number) {
  const clash = await prisma.employee.findFirst({
    where: {
      storeId: DEFAULT_STORE_ID,
      code,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(clash);
}

export async function createEmployee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  if (await codeTaken(d.code)) {
    return { ok: false, errors: { code: ["That employee code is already in use"] } };
  }
  if (d.terminationDate && d.terminationDate < d.hireDate) {
    return {
      ok: false,
      errors: { terminationDate: ["Termination cannot precede the hire date"] },
    };
  }
  if (d.departmentId !== null && !(await departmentBelongsToStore(d.departmentId))) {
    return { ok: false, errors: { departmentId: ["Unknown department"] } };
  }

  const photo = await resolveImageInput(
    formData.get("photoFile") as File | null,
    formData.get("photoUrl") as string | null,
    "employees",
  );
  if (photo && !photo.ok) return { ok: false, errors: { photoUrl: [photo.error] } };

  const employee = await prisma.employee.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      code: d.code,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      dateOfBirth: toDate(d.dateOfBirth),
      gender: d.gender,
      nationalId: d.nationalId,
      address: d.address,
      city: d.city,
      departmentId: d.departmentId,
      designation: d.designation,
      employmentType: d.employmentType,
      hireDate: toDate(d.hireDate)!,
      terminationDate: toDate(d.terminationDate),
      basicSalary: d.basicSalary,
      bankName: d.bankName,
      bankAccount: d.bankAccount,
      mobileBanking: d.mobileBanking,
      emergencyContactName: d.emergencyContactName,
      emergencyContactPhone: d.emergencyContactPhone,
      photo: photo?.ok ? photo.path : null,
      status: d.status,
      notes: d.notes,
    },
    select: { id: true },
  });

  revalidatePath("/admin/employees");
  redirect(`/admin/employees/${employee.id}?created=1`);
}

export async function updateEmployee(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.employee.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, photo: true },
  });
  if (!existing) return { ok: false, message: "That employee no longer exists." };

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  if (await codeTaken(d.code, id)) {
    return { ok: false, errors: { code: ["That employee code is already in use"] } };
  }
  if (d.terminationDate && d.terminationDate < d.hireDate) {
    return {
      ok: false,
      errors: { terminationDate: ["Termination cannot precede the hire date"] },
    };
  }
  if (d.departmentId !== null && !(await departmentBelongsToStore(d.departmentId))) {
    return { ok: false, errors: { departmentId: ["Unknown department"] } };
  }

  const photo = await resolveImageInput(
    formData.get("photoFile") as File | null,
    formData.get("photoUrl") as string | null,
    "employees",
  );
  if (photo && !photo.ok) return { ok: false, errors: { photoUrl: [photo.error] } };

  await prisma.employee.update({
    where: { id },
    data: {
      code: d.code,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      dateOfBirth: toDate(d.dateOfBirth),
      gender: d.gender,
      nationalId: d.nationalId,
      address: d.address,
      city: d.city,
      departmentId: d.departmentId,
      designation: d.designation,
      employmentType: d.employmentType,
      hireDate: toDate(d.hireDate)!,
      terminationDate: toDate(d.terminationDate),
      basicSalary: d.basicSalary,
      bankName: d.bankName,
      bankAccount: d.bankAccount,
      mobileBanking: d.mobileBanking,
      emergencyContactName: d.emergencyContactName,
      emergencyContactPhone: d.emergencyContactPhone,
      ...(photo?.ok ? { photo: photo.path } : {}),
      status: d.status,
      notes: d.notes,
    },
  });

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${id}`);
  return { ok: true, message: "Employee saved." };
}

export async function deleteEmployee(id: number): Promise<FormState> {
  await requireStaff();

  const employee = await prisma.employee.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, status: true },
  });
  if (!employee) return { ok: false, message: "Employee not found." };

  // Attendance and payroll rows are history. Never orphan them — terminate the
  // record instead, which is what an HR audit trail expects.
  const [payrollCount, attendanceCount] = await Promise.all([
    prisma.payrollDetail.count({ where: { employeeId: id } }),
    prisma.attendance.count({ where: { employeeId: id } }),
  ]);

  if (payrollCount > 0 || attendanceCount > 0) {
    await prisma.employee.update({
      where: { id },
      data: {
        status: "TERMINATED",
        terminationDate: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"),
      },
    });
    revalidatePath("/admin/employees");
    return {
      ok: true,
      message:
        "This employee has attendance or payroll history, so the record was marked terminated rather than deleted.",
    };
  }

  await prisma.employee.delete({ where: { id } });
  revalidatePath("/admin/employees");
  return { ok: true, message: "Employee deleted." };
}

/* -------------------------------------------------------------------------
   Salary structure (EmployeeSalaryComponent)
   ------------------------------------------------------------------------- */

const salaryStructureSchema = z.object({
  componentId: z.coerce.number().int().positive("Choose a component"),
  amount: z.coerce.number().min(0, "Amount cannot be negative"),
  effectiveFrom: dateString,
  effectiveTo: optionalDateString,
});

export async function addEmployeeSalaryComponent(
  employeeId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!employee) return { ok: false, message: "Employee not found." };

  const parsed = salaryStructureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  if (d.effectiveTo && d.effectiveTo < d.effectiveFrom) {
    return { ok: false, errors: { effectiveTo: ["End date must follow the start date"] } };
  }

  const component = await prisma.salaryComponent.findFirst({
    where: { id: d.componentId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!component) return { ok: false, errors: { componentId: ["Unknown component"] } };

  await prisma.employeeSalaryComponent.create({
    data: {
      employeeId,
      componentId: d.componentId,
      amount: d.amount,
      effectiveFrom: toDate(d.effectiveFrom)!,
      effectiveTo: toDate(d.effectiveTo),
    },
  });

  revalidatePath(`/admin/employees/${employeeId}`);
  return { ok: true, message: "Salary component added." };
}

export async function removeEmployeeSalaryComponent(rowId: number): Promise<FormState> {
  await requireStaff();

  const row = await prisma.employeeSalaryComponent.findUnique({
    where: { id: rowId },
    select: { id: true, employeeId: true, employee: { select: { storeId: true } } },
  });
  if (!row || row.employee.storeId !== DEFAULT_STORE_ID) {
    return { ok: false, message: "Salary component not found." };
  }

  await prisma.employeeSalaryComponent.delete({ where: { id: rowId } });

  revalidatePath(`/admin/employees/${row.employeeId}`);
  return { ok: true, message: "Salary component removed." };
}

/* -------------------------------------------------------------------------
   Departments
   ------------------------------------------------------------------------- */

async function departmentBelongsToStore(id: number) {
  const dept = await prisma.department.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  return Boolean(dept);
}

const departmentSchema = z.object({
  name: z.string().trim().min(2, "Enter a department name").max(100),
  code: optionalText(20),
  description: optionalText(2000),
  managerId: z.preprocess(
    blankToNull,
    z.coerce.number().int().positive().nullable().default(null),
  ),
  isActive: z.coerce.boolean().default(true),
});

function readDepartment(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const checked = formData.get("isActive");
  return departmentSchema.safeParse({
    ...raw,
    isActive: checked === "on" || checked === "true" || checked === "1",
  });
}

export async function createDepartment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readDepartment(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  await prisma.department.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      code: d.code,
      description: d.description,
      managerId: d.managerId,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/employees/departments");
  revalidatePath("/admin/employees");
  return { ok: true, message: "Department created." };
}

export async function updateDepartment(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  if (!(await departmentBelongsToStore(id))) {
    return { ok: false, message: "Department not found." };
  }

  const parsed = readDepartment(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  await prisma.department.update({
    where: { id },
    data: {
      name: d.name,
      code: d.code,
      description: d.description,
      managerId: d.managerId,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/employees/departments");
  revalidatePath("/admin/employees");
  return { ok: true, message: "Department saved." };
}

export async function deleteDepartment(id: number): Promise<FormState> {
  await requireStaff();

  if (!(await departmentBelongsToStore(id))) {
    return { ok: false, message: "Department not found." };
  }

  // The FK is `onDelete: SetNull`, but do it explicitly inside a transaction so
  // the reassignment is visible and cannot half-apply.
  const moved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.employee.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    });
    await tx.department.delete({ where: { id } });
    return count;
  });

  revalidatePath("/admin/employees/departments");
  revalidatePath("/admin/employees");
  return {
    ok: true,
    message:
      moved > 0
        ? `Department deleted. ${moved} employee${moved === 1 ? " was" : "s were"} left unassigned.`
        : "Department deleted.",
  };
}
