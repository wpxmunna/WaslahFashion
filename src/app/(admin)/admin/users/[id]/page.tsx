import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader } from "@/components/admin/ui";
import { StaffForm } from "@/components/admin/staff-form";
import { StaffToggleButton } from "@/components/admin/staff-toggle-button";
import { deleteStaff } from "@/actions/admin/staff";
import { requireAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: user?.name ?? "Staff member" };
}

export default async function EditStaffPage({ params }: Props) {
  const current = await requireAdmin();

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) notFound();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  // Customer accounts are not editable through the staff screen.
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) notFound();

  const isSelf = user.id === current.id;

  return (
    <>
      <PageHeader
        title={user.name}
        description={`${user.email} · Last login ${
          user.lastLoginAt ? dateTime.format(user.lastLoginAt) : "never"
        }`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/users", label: "Staff" },
        ]}
        actions={
          isSelf ? undefined : (
            <>
              <StaffToggleButton id={user.id} isActive={user.isActive} />
              <DeleteButton
                id={user.id}
                action={deleteStaff}
                redirectTo="/admin/users"
                label="Delete"
                confirmTitle="Delete this staff member?"
                confirmBody="If the account is recorded against past transactions it will be deactivated instead. Removing the last active administrator is refused."
              />
            </>
          )
        }
      />

      <StaffForm
        values={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          role: user.role === "ADMIN" ? "ADMIN" : "MANAGER",
          isActive: user.isActive,
        }}
        isSelf={isSelf}
      />
    </>
  );
}
