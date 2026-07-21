import { PageHeader } from "@/components/admin/ui";
import { CourierForm } from "@/components/admin/courier-form";
import { emptyCourierValues } from "@/components/admin/courier-form-constants";
import { requireStaff } from "@/lib/admin/guard";

export const metadata = { title: "New courier" };

export default async function NewCourierPage() {
  await requireStaff();

  return (
    <>
      <PageHeader
        title="New courier"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/couriers", label: "Couriers" },
        ]}
      />
      <CourierForm values={emptyCourierValues} />
    </>
  );
}
