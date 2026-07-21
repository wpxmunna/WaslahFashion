import { PageHeader } from "@/components/admin/ui";
import { StaffForm } from "@/components/admin/staff-form";
import { emptyStaffValues } from "@/components/admin/staff-form-constants";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata = { title: "New staff member" };

export default async function NewStaffPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="New staff member"
        description="Administrators and managers can sign in to this panel."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/users", label: "Staff" },
        ]}
      />
      <StaffForm values={emptyStaffValues} />
    </>
  );
}
