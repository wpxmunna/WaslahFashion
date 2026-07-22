import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { requireStaff } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Waslah admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Every admin route inherits this gate, so no page can be reached without it.
  const user = await requireStaff();

  return (
    <AdminShell
      user={{ name: user.name, role: user.role }}
      isFullAdmin={user.role === "ADMIN"}
    >
      {children}
    </AdminShell>
  );
}
