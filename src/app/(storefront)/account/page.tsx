import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export default async function AccountOverviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [stats, recentOrders, wishlistCount] = await Promise.all([
    prisma.order.aggregate({
      where: { userId: user.id, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <dl className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
          <Stat label="Orders" value={String(stats._count._all)} />
          <Stat
            label="Total spent"
            value={formatPrice(stats._sum.totalAmount ?? 0)}
          />
          <Stat label="Wishlist" value={String(wishlistCount)} />
        </dl>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight">Recent orders</h2>
          {recentOrders.length > 0 && (
            <Link href="/account/orders" className="link-wipe kicker">
              View all
            </Link>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-6 border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">You haven&apos;t ordered anything yet.</p>
            <Link href="/shop" className="link-wipe kicker mt-4 inline-block">
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-border border-y border-border">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/order/${order.orderNumber}`}
                  className="group flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm tabular-nums">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      · {order._count.items}{" "}
                      {order._count.items === 1 ? "item" : "items"} ·{" "}
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </p>
                  </div>
                  <p className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
                    {formatPrice(order.totalAmount)}
                    <ArrowRight
                      className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                      strokeWidth={1.7}
                    />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-5">
      <dt className="kicker text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-display text-[1.75rem] font-bold tabular-nums">{value}</dd>
    </div>
  );
}
