"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

const STAFF_ROLES = ["ADMIN", "MANAGER"] as const;

const baseSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(100),
  email: z.email("Enter a valid email").max(100),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(STAFF_ROLES, { message: "Choose a role" }),
  isActive: z.coerce.boolean().default(true),
});

const createSchema = baseSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const updateSchema = baseSchema.extend({
  // Blank means "leave the password unchanged".
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 8, "Password must be at least 8 characters"),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

/**
 * Number of *other* active admins. The system must always retain at least one,
 * so every demotion, deactivation and deletion of an admin checks this first.
 */
async function otherActiveAdmins(excludeId: number): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: excludeId } },
  });
}

const LAST_ADMIN_MESSAGE =
  "This is the only remaining active administrator. Promote or activate another admin first.";

export async function createStaff(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = createSchema.safeParse({
    ...Object.fromEntries(formData),
    isActive: parseCheckbox(formData, "isActive"),
  });
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const email = d.email.trim().toLowerCase();

  const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (clash) {
    return { ok: false, errors: { email: ["That email is already registered"] } };
  }

  const user = await prisma.user.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      email,
      passwordHash: await hashPassword(d.password),
      phone: d.phone || null,
      role: d.role,
      isActive: d.isActive,
    },
    select: { id: true },
  });

  revalidatePath("/admin/users");
  redirect(`/admin/users/${user.id}?created=1`);
}

export async function updateStaff(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const current = await requireAdmin();

  const parsed = updateSchema.safeParse({
    ...Object.fromEntries(formData),
    isActive: parseCheckbox(formData, "isActive"),
  });
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const email = d.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  });
  if (!existing) return { ok: false, message: "That user no longer exists." };
  if (existing.role !== "ADMIN" && existing.role !== "MANAGER") {
    return { ok: false, message: "That account is not a staff account." };
  }

  const demoting = existing.role === "ADMIN" && d.role !== "ADMIN";
  const deactivating = existing.isActive && !d.isActive;

  // Self-protection: you can never lock yourself out of your own account.
  if (id === current.id) {
    if (demoting) {
      return { ok: false, message: "You cannot change your own role." };
    }
    if (deactivating) {
      return { ok: false, message: "You cannot deactivate your own account." };
    }
  }

  // Last-admin protection, which the legacy PHP lacked entirely.
  if (existing.role === "ADMIN" && existing.isActive && (demoting || deactivating)) {
    if ((await otherActiveAdmins(id)) === 0) {
      return { ok: false, message: LAST_ADMIN_MESSAGE };
    }
  }

  const clash = await prisma.user.findFirst({
    where: { email, id: { not: id } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, errors: { email: ["That email is already registered"] } };
  }

  await prisma.user.update({
    where: { id },
    data: {
      name: d.name,
      email,
      phone: d.phone || null,
      role: d.role,
      isActive: d.isActive,
      ...(d.password ? { passwordHash: await hashPassword(d.password) } : {}),
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return {
    ok: true,
    message: d.password ? "Staff member saved and password reset." : "Staff member saved.",
  };
}

export async function toggleStaffActive(id: number): Promise<FormState> {
  const current = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!user) return { ok: false, message: "That user no longer exists." };
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return { ok: false, message: "That account is not a staff account." };
  }

  if (user.isActive) {
    if (id === current.id) {
      return { ok: false, message: "You cannot deactivate your own account." };
    }
    if (user.role === "ADMIN" && (await otherActiveAdmins(id)) === 0) {
      return { ok: false, message: LAST_ADMIN_MESSAGE };
    }
  }

  await prisma.user.update({ where: { id }, data: { isActive: !user.isActive } });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return {
    ok: true,
    message: user.isActive
      ? `${user.name} has been deactivated.`
      : `${user.name} has been activated.`,
  };
}

export async function deleteStaff(id: number): Promise<FormState> {
  const current = await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  });
  if (!user) return { ok: false, message: "That user no longer exists." };
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return { ok: false, message: "That account is not a staff account." };
  }

  if (id === current.id) {
    return { ok: false, message: "You cannot delete your own account." };
  }
  if (user.role === "ADMIN" && user.isActive && (await otherActiveAdmins(id)) === 0) {
    return { ok: false, message: LAST_ADMIN_MESSAGE };
  }

  // A staff account can be the recorded author of POS transactions, journals and
  // expenses (all `ON DELETE SET NULL`, so a delete silently orphans the audit
  // trail) and may own an Employee row that cascade-deletes with it. Deactivate
  // instead and say so, as `deleteProduct` does for ordered products.
  const [posTransactions, journals, expenses, employees] = await Promise.all([
    prisma.posTransaction.count({ where: { createdById: id } }),
    prisma.journalEntry.count({ where: { createdById: id } }),
    prisma.expense.count({ where: { createdById: id } }),
    prisma.employee.count({ where: { userId: id } }),
  ]);

  if (posTransactions > 0 || journals > 0 || expenses > 0 || employees > 0) {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${id}`);
    return {
      ok: true,
      message:
        "This account is recorded against past transactions, so it was deactivated rather than deleted.",
    };
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  return { ok: true, message: "Staff member deleted." };
}
