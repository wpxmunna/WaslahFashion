import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser, type CurrentUser } from "@/lib/auth";

/**
 * Staff gate for admin routes.
 *
 * The legacy app kept a completely separate admin session (`$_SESSION['admin_id']`)
 * from the customer one. We use a single session carrying the role instead —
 * simpler, and it removes the class of bug where the two sessions disagreed.
 */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) redirect("/login?redirectTo=/admin");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  return user;
}

/**
 * Full-admin gate. Mirrors the legacy `requireFullAdmin()` / `isFullAdmin()`
 * helpers, which excluded managers from sensitive screens (users, settings,
 * stores, payroll approval, accounting).
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (user.role !== "ADMIN") redirect("/admin?denied=1");
  return user;
}

export function isFullAdmin(user: { role: string } | null | undefined): boolean {
  return user?.role === "ADMIN";
}
