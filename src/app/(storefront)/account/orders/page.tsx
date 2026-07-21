import type { Metadata } from "next";
import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { getCurrentUser } from "@/lib/auth";
import { ORDERS_PER_PAGE } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Orders" };

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const raw = await searchParams;
  const pageRaw = Number(Array.isArray(raw.page) ? raw.page[0] : raw.page);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ORDERS_PER_PAGE,
      take: ORDERS_PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true }, take: 3 },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { userId: user.id } }),
  ]);

  if (total === 0) {
    return (
      <div className="border border-dashed border-border p-12 text-center">
        <p className="font-display text-2xl">No orders yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          When you place an order it will appear here.
        </p>
        <Link href="/shop" className="link-wipe kicker mt-5 inline-block">
          Browse the collection
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl">Order history</h2>

      <ul className="mt-6 space-y-3">
        {orders.map((order) => (
          <li key={order.id} className="border border-border p-5 transition-colors hover:bg-secondary/40">
            <Link href={`/order/${order.orderNumber}`} className="block">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm tabular-nums">{order.orderNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg tabular-nums">
                    {formatPrice(order.totalAmount)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ORDER_STATUS_LABELS[order.status] ?? order.status} ·{" "}
                    {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                  </p>
                </div>
              </div>

              <p className="mt-3 truncate text-sm text-muted-foreground">
                {order.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
                {order._count.items > order.items.length &&
                  ` and ${order._count.items - order.items.length} more`}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / ORDERS_PER_PAGE)}
        basePath="/account/orders"
      />
    </div>
  );
}
