import type { Metadata } from "next";
import Link from "next/link";
import { Check, Package, Search, Truck } from "lucide-react";

import { getSession } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check where your Waslah order has got to.",
};

/** Fulfilment stages, in the order a parcel passes through them. */
const STAGES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const orderNumber = first(raw.order)?.trim();

  const order = orderNumber
    ? await prisma.order.findUnique({
        where: { orderNumber },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
          userId: true,
          shippingName: true,
          shippingCity: true,
          items: { select: { id: true, productName: true, quantity: true } },
          shipment: {
            select: {
              courierName: true,
              trackingNumber: true,
              status: true,
              shippedAt: true,
              deliveredAt: true,
              courier: { select: { name: true, trackingUrl: true } },
              events: { orderBy: { trackedAt: "desc" }, take: 20 },
            },
          },
        },
      })
    : null;

  // An order belonging to a registered account is only shown to that account.
  // Guest orders stay reachable by their number, which is the only handle a
  // guest has — the same rule the confirmation page applies.
  const session = await getSession();
  const visible = order && (order.userId === null || order.userId === session?.userId);
  const notFound = !!orderNumber && !visible;

  const stageIndex = order ? STAGES.indexOf(order.status as (typeof STAGES)[number]) : -1;
  const cancelled = order?.status === "CANCELLED" || order?.status === "REFUNDED";

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <header className="text-center">
        <p className="kicker text-[color:var(--accent)]">Order tracking</p>
        <h1 className="mt-2 font-display text-[clamp(2rem,4vw,2.75rem)] leading-tight">
          Where is my order?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Enter the order number from your confirmation, e.g. WAS-20260721-A3F91C.
        </p>
      </header>

      <form method="get" className="mx-auto mt-8 flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.7}
          />
          <input
            name="order"
            defaultValue={orderNumber ?? ""}
            placeholder="WAS-…"
            aria-label="Order number"
            required
            className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm uppercase outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="h-11 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Track
        </button>
      </form>

      {notFound && (
        <p className="mx-auto mt-8 max-w-md rounded-md border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">
          We couldn&apos;t find an order with that number. Check it against your
          confirmation email, or{" "}
          <Link href="/login" className="link-wipe font-medium">
            sign in
          </Link>{" "}
          if it was placed on your account.
        </p>
      )}

      {order && visible && (
        <div className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="font-display text-xl tabular-nums">{order.orderNumber}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Placed{" "}
                {order.createdAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {order.shippingCity && ` · to ${order.shippingCity}`}
              </p>
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">
                {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus} ·{" "}
              </span>
              <span className="tabular-nums">{formatPrice(order.totalAmount)}</span>
            </p>
          </div>

          {cancelled ? (
            <p className="mt-8 rounded-md border border-border bg-secondary/50 p-5 text-center">
              This order was {ORDER_STATUS_LABELS[order.status]?.toLowerCase()}. If that
              wasn&apos;t expected, please get in touch.
            </p>
          ) : (
            <ol className="mt-10 grid gap-4 sm:grid-cols-4">
              {STAGES.map((stage, i) => {
                const done = i <= stageIndex;
                const current = i === stageIndex;
                return (
                  <li key={stage} className="relative">
                    <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors",
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {done ? (
                          <Check className="size-4" strokeWidth={2.5} />
                        ) : i === 2 ? (
                          <Truck className="size-4" strokeWidth={1.7} />
                        ) : (
                          <Package className="size-4" strokeWidth={1.7} />
                        )}
                      </span>
                      <span>
                        <span
                          className={cn(
                            "block text-sm",
                            current ? "font-semibold" : done ? "" : "text-muted-foreground",
                          )}
                        >
                          {ORDER_STATUS_LABELS[stage]}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {order.shipment && (
            <section className="mt-10 rounded-md border border-border p-5">
              <h2 className="kicker text-muted-foreground">Courier</h2>
              <p className="mt-2 text-sm">
                {order.shipment.courierName ?? order.shipment.courier?.name ?? "Assigned soon"}
                {order.shipment.trackingNumber && (
                  <>
                    {" · "}
                    <span className="tabular-nums">{order.shipment.trackingNumber}</span>
                  </>
                )}
              </p>

              {order.shipment.events.length > 0 && (
                <ol className="mt-5 space-y-3 border-t border-border pt-4">
                  {order.shipment.events.map((event) => (
                    <li key={event.id} className="flex gap-3 text-sm">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>
                        <span className="block">{event.status}</span>
                        <span className="block text-xs text-muted-foreground">
                          {event.location && `${event.location} · `}
                          {event.trackedAt.toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          <section className="mt-8">
            <h2 className="kicker text-muted-foreground">Items</h2>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                  <span>{item.productName}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    ×{item.quantity}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
