"use server";

import { revalidatePath } from "next/cache";

import { type FormState } from "@/actions/types";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

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
