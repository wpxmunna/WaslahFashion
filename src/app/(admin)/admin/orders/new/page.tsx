import { PageHeader } from "@/components/admin/ui";
import { OrderCreateForm } from "@/components/admin/order-create-form";
import { requireStaff } from "@/lib/admin/guard";

export const metadata = { title: "New order" };

export default async function NewOrderPage() {
  await requireStaff();

  return (
    <>
      <PageHeader
        title="Create order"
        description="Enter an order taken over Facebook, WhatsApp or phone."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/orders", label: "Orders" },
        ]}
      />
      <OrderCreateForm />
    </>
  );
}
