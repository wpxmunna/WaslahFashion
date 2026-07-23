import { PageHeader } from "@/components/admin/ui";
import { CustomerForm } from "@/components/admin/customer-form";
import { requireStaff } from "@/lib/admin/guard";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  await requireStaff();

  return (
    <>
      <PageHeader
        title="New customer"
        description="Add someone who ordered over Facebook, WhatsApp or phone."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/customers", label: "Customers" },
        ]}
      />
      <CustomerForm />
    </>
  );
}
