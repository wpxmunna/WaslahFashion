import { notFound } from "next/navigation";

import { deleteCoupon } from "@/actions/admin/coupons";
import { CouponForm } from "@/components/admin/coupon-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader, StatCard } from "@/components/admin/ui";
import type { CouponType } from "@/components/admin/coupon-types";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const coupon = await prisma.coupon.findUnique({
    where: { id: Number(id) },
    select: { code: true },
  });
  return { title: coupon?.code ?? "Coupon" };
}

/**
 * `datetime-local` wants `YYYY-MM-DDTHH:mm` with no zone. Formatting here on
 * the server pairs with the action, which parses the same string back with
 * `new Date()` — so the value an admin sees round-trips unchanged.
 */
function toLocalInput(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default async function EditCouponPage({ params }: Props) {
  const { id } = await params;
  const couponId = Number(id);
  if (!Number.isInteger(couponId)) notFound();

  const [coupon, products] = await Promise.all([
    prisma.coupon.findFirst({
      where: { id: couponId, storeId: DEFAULT_STORE_ID },
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        minimumAmount: true,
        maximumDiscount: true,
        giftProductId: true,
        buyQuantity: true,
        getQuantity: true,
        usageLimit: true,
        usedCount: true,
        startsAt: true,
        expiresAt: true,
        isActive: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.product.findMany({
      where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, sku: true },
    }),
  ]);

  if (!coupon) notFound();

  // A gift product that has since been archived is still the coupon's gift, so
  // make sure it stays selectable rather than silently resetting the field.
  const giftProducts = [...products];
  if (
    coupon.giftProductId !== null &&
    !giftProducts.some((p) => p.id === coupon.giftProductId)
  ) {
    const gift = await prisma.product.findFirst({
      where: { id: coupon.giftProductId, storeId: DEFAULT_STORE_ID },
      select: { id: true, name: true, sku: true },
    });
    if (gift) giftProducts.unshift(gift);
  }

  const locked = coupon.usedCount > 0 || coupon._count.orders > 0;
  const num = (v: unknown) => String(toNumber(v as never));

  return (
    <>
      <PageHeader
        title={coupon.code}
        description={coupon.isActive ? "Active coupon" : "Inactive coupon"}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/coupons", label: "Coupons" },
        ]}
        actions={
          <DeleteButton
            id={coupon.id}
            action={deleteCoupon}
            redirectTo="/admin/coupons"
            label="Delete"
            confirmTitle="Delete this coupon?"
            confirmBody={
              locked
                ? "This coupon has been redeemed, so it will be deactivated instead — order history keeps its discount record."
                : "This cannot be undone."
            }
          />
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Redemptions"
          value={String(coupon.usedCount)}
          hint={
            coupon.usageLimit === null
              ? "No usage limit"
              : `Limit ${coupon.usageLimit}`
          }
        />
        <StatCard
          label="Orders"
          value={String(coupon._count.orders)}
          hint={
            coupon._count.orders === 0
              ? "Not on any order yet"
              : "Orders carrying this code"
          }
        />
        <StatCard
          label="Remaining"
          value={
            coupon.usageLimit === null
              ? "∞"
              : String(Math.max(0, coupon.usageLimit - coupon.usedCount))
          }
          hint={locked ? "Deletion will deactivate instead" : "Uses left"}
        />
      </div>

      <CouponForm
        values={{
          id: coupon.id,
          code: coupon.code,
          type: coupon.type as CouponType,
          value: num(coupon.value),
          minimumAmount: num(coupon.minimumAmount),
          maximumDiscount:
            coupon.maximumDiscount === null ? "" : num(coupon.maximumDiscount),
          giftProductId: coupon.giftProductId,
          buyQuantity: coupon.buyQuantity === null ? "1" : String(coupon.buyQuantity),
          getQuantity: coupon.getQuantity === null ? "1" : String(coupon.getQuantity),
          usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
          startsAt: toLocalInput(coupon.startsAt),
          expiresAt: toLocalInput(coupon.expiresAt),
          isActive: coupon.isActive,
          usedCount: coupon.usedCount,
        }}
        products={giftProducts}
      />
    </>
  );
}
