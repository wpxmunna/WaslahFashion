import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Package, Truck } from "lucide-react";

import { getSession } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

type Props = { params: Promise<{ orderNumber: string }> };

export default async function OrderPage({ params }: Props) {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { orderBy: { id: "asc" } },
      shipment: { include: { courier: { select: { name: true } } } },
    },
  });

  if (!order) notFound();

  // Legacy applied its ownership check only when logged in, so a signed-out
  // visitor could read any order by guessing the number. A registered user's
  // order is now visible only to that user; guest orders remain reachable by
  // their number, which is the only handle a guest has.
  const session = await getSession();
  if (order.userId !== null && order.userId !== session?.userId) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/15">
          <Check className="size-7 text-primary" strokeWidth={2} />
        </span>
        <h1 className="mt-6 font-display text-[clamp(2rem,4vw,2.75rem)] leading-tight">
          Thank you — your order is in
        </h1>
        <p className="mt-3 text-muted-foreground">
          We&apos;ve reserved your pieces. A confirmation is on its way to you.
        </p>
        <p className="kicker mt-6 inline-block border border-border px-4 py-2">
          {order.orderNumber}
        </p>
      </div>

      <dl className="mt-12 grid grid-cols-2 gap-6 border-y border-border py-6 text-sm sm:grid-cols-4">
        <div>
          <dt className="kicker text-muted-foreground">Status</dt>
          <dd className="mt-1.5">{ORDER_STATUS_LABELS[order.status] ?? order.status}</dd>
        </div>
        <div>
          <dt className="kicker text-muted-foreground">Payment</dt>
          <dd className="mt-1.5">
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </dd>
        </div>
        <div>
          <dt className="kicker text-muted-foreground">Placed</dt>
          <dd className="mt-1.5">
            {order.createdAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </dd>
        </div>
        <div>
          <dt className="kicker text-muted-foreground">Total</dt>
          <dd className="mt-1.5 tabular-nums">{formatPrice(order.totalAmount)}</dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="kicker text-muted-foreground">Items</h2>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-sm">{item.productName}</p>
                {item.variantInfo && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.variantInfo}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  Qty {item.quantity} · {formatPrice(item.unitPrice)} each
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums">{formatPrice(item.totalPrice)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-6 space-y-2.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-primary">
              <dt>Discount {order.couponCode && `(${order.couponCode})`}</dt>
              <dd className="tabular-nums">−{formatPrice(order.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="tabular-nums">
              {Number(order.shippingAmount) === 0
                ? "Free"
                : formatPrice(order.shippingAmount)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="font-display text-lg">Total</dt>
            <dd className="font-display text-lg tabular-nums">
              {formatPrice(order.totalAmount)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <section className="border border-border p-5">
          <h2 className="kicker flex items-center gap-2 text-muted-foreground">
            <Package className="size-3.5" strokeWidth={1.7} />
            Delivering to
          </h2>
          <address className="mt-3 text-sm not-italic leading-relaxed">
            {order.shippingName}
            <br />
            {order.shippingLine1}
            {order.shippingLine2 && (
              <>
                <br />
                {order.shippingLine2}
              </>
            )}
            <br />
            {[order.shippingCity, order.shippingState, order.shippingPostalCode]
              .filter(Boolean)
              .join(", ")}
            <br />
            {order.shippingCountry}
            {order.shippingPhone && (
              <>
                <br />
                {order.shippingPhone}
              </>
            )}
          </address>
        </section>

        {order.shipment && (
          <section className="border border-border p-5">
            <h2 className="kicker flex items-center gap-2 text-muted-foreground">
              <Truck className="size-3.5" strokeWidth={1.7} />
              Courier
            </h2>
            <p className="mt-3 text-sm">
              {order.shipment.courierName ?? order.shipment.courier?.name ?? "Assigned soon"}
            </p>
            {order.shipment.trackingNumber && (
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                Tracking: {order.shipment.trackingNumber}
              </p>
            )}
          </section>
        )}
      </div>

      <div className="mt-12 flex flex-wrap justify-center gap-4">
        <Link href="/shop" className="link-wipe kicker">
          Continue shopping
        </Link>
        <Link href="/account/orders" className="link-wipe kicker text-muted-foreground">
          View all orders
        </Link>
      </div>
    </div>
  );
}
