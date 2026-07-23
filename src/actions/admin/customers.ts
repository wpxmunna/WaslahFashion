"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fieldErrors, type FormState } from "@/actions/types";
import { requireStaff } from "@/lib/admin/guard";
import { hashPassword } from "@/lib/auth";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  phone: z.string().trim().max(20).optional(),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
});

/**
 * Create a customer from the admin — for people who order over Facebook or
 * WhatsApp and have no account. Email is optional (a placeholder is generated
 * so the unique-email constraint holds); the password is random, so the record
 * exists for linking orders without granting a login until the person resets it.
 */
export async function createCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }
  const d = parsed.data;

  const email = d.email?.trim()
    ? d.email.trim().toLowerCase()
    : `walk-in-${Date.now()}-${randomBytes(3).toString("hex")}@customers.waslah.local`;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, errors: { email: ["An account with this email already exists"] } };
  }

  const passwordHash = await hashPassword(randomBytes(24).toString("hex"));

  const user = await prisma.user.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      email,
      phone: d.phone || null,
      passwordHash,
      role: "CUSTOMER",
    },
    select: { id: true },
  });

  revalidatePath("/admin/customers");
  redirect(`/admin/customers/${user.id}?created=1`);
}

/**
 * Enable or disable a customer login.
 *
 * Legacy exposed this as an unauthenticated GET with no CSRF token and no role
 * check, so an admin could lock *themselves* out from the customer screen. Only
 * `CUSTOMER` accounts are togglable here; staff accounts are managed under
 * Staff, which is admin-only.
 */
export async function toggleCustomerActive(userId: number): Promise<FormState> {
  await requireStaff();

  const customer = await prisma.user.findFirst({
    where: { id: userId, storeId: DEFAULT_STORE_ID },
    select: { id: true, role: true, isActive: true, name: true },
  });
  if (!customer) return { ok: false, message: "That customer no longer exists." };

  if (customer.role !== "CUSTOMER") {
    return {
      ok: false,
      message: "Staff accounts cannot be changed here — use the Staff screen.",
    };
  }

  const next = !customer.isActive;

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: next },
  });

  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${userId}`);

  return {
    ok: true,
    message: next
      ? `${customer.name} can sign in again.`
      : `${customer.name} has been deactivated.`,
  };
}
