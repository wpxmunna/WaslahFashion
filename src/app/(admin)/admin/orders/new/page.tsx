import { PageHeader } from "@/components/admin/ui";
import { OrderCreateForm } from "@/components/admin/order-create-form";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "New order" };

export default async function NewOrderPage() {
  await requireStaff();

  const couriers = await prisma.courier.findMany({
    where: { storeId: DEFAULT_STORE_ID, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

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
      <OrderCreateForm couriers={couriers} />
    </>
  );
}
