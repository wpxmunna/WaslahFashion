import { CouponForm } from "@/components/admin/coupon-form";
import { emptyCouponValues } from "@/components/admin/coupon-form-constants";
import { PageHeader } from "@/components/admin/ui";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "New coupon" };

export default async function NewCouponPage() {
  // Candidates for a gift-item coupon. Capped because the picker filters in
  // the browser; a catalogue past this size needs a server-side search.
  const products = await prisma.product.findMany({
    where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, sku: true },
  });

  return (
    <>
      <PageHeader
        title="New coupon"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/coupons", label: "Coupons" },
        ]}
      />
      <CouponForm values={emptyCouponValues} products={products} />
    </>
  );
}
