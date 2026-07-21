import Link from "next/link";
import { format } from "date-fns";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { ReturnCreateForm, type ReturnableLine } from "@/components/admin/return-create-form";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { RETURNABLE_ORDER_STATUSES } from "@/lib/returns";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "Record a return" };

type OrderStatus = "PROCESSING" | "SHIPPED" | "DELIVERED";

const BREADCRUMB = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/returns", label: "Returns" },
];

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const orderIdRaw = Number(first(raw.orderId));
  const orderId = Number.isInteger(orderIdRaw) && orderIdRaw > 0 ? orderIdRaw : null;

  // Step one: choose the order the goods came back from.
  if (orderId === null) {
    const orders = await prisma.order.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        status: { in: RETURNABLE_ORDER_STATUSES as OrderStatus[] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        totalAmount: true,
        shippingName: true,
        user: { select: { name: true } },
        _count: { select: { returns: true } },
      },
    });

    return (
      <>
        <PageHeader
          title="Record a return"
          description="Pick the order the goods came back from. Processing, shipped and delivered orders are eligible."
          breadcrumb={BREADCRUMB}
        />

        <Panel title="Recent eligible orders">
          {orders.length === 0 ? (
            <EmptyState
              title="No eligible orders"
              description="Returns can only be raised against processing, shipped or delivered orders."
              action={
                <Link href="/admin/orders" className={buttonVariants()}>
                  Go to orders
                </Link>
              }
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th align="right">Total</Th>
                <Th />
              </THead>
              <TBody>
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-secondary/40">
                    <Td>
                      <span className="block font-medium">{o.orderNumber}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {format(o.createdAt, "d MMM yyyy")}
                        {o._count.returns > 0 &&
                          ` · ${o._count.returns} earlier return${o._count.returns === 1 ? "" : "s"}`}
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">
                      {o.user?.name ?? o.shippingName ?? "Guest"}
                    </Td>
                    <Td>
                      <StatusBadge status={o.status} />
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(o.totalAmount)}
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/admin/returns/new?orderId=${o.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Select
                      </Link>
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>
      </>
    );
  }

  // Step two: choose the lines and quantities.
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productName: true,
          variantInfo: true,
          unitPrice: true,
          quantity: true,
          isGift: true,
        },
      },
    },
  });

  if (!order) {
    return (
      <>
        <PageHeader title="Record a return" breadcrumb={BREADCRUMB} />
        <Panel>
          <EmptyState
            title="Order not found"
            description="That order does not exist in this store."
            action={
              <Link href="/admin/returns/new" className={buttonVariants()}>
                Choose another order
              </Link>
            }
          />
        </Panel>
      </>
    );
  }

  const priorRows = await prisma.returnItem.groupBy({
    by: ["orderItemId"],
    where: { return: { orderId: order.id } },
    _sum: { quantity: true },
  });
  const prior = new Map(priorRows.map((r) => [r.orderItemId, r._sum.quantity ?? 0]));

  const lines: ReturnableLine[] = order.items.map((item) => ({
    orderItemId: item.id,
    productName: item.productName,
    variantInfo: item.variantInfo,
    unitPrice: toNumber(item.unitPrice),
    ordered: item.quantity,
    remaining: Math.max(0, item.quantity - (prior.get(item.id) ?? 0)),
    isGift: item.isGift,
  }));

  const anyRemaining = lines.some((l) => l.remaining > 0);

  return (
    <>
      <PageHeader
        title="Record a return"
        description={`Order ${order.orderNumber}`}
        breadcrumb={[...BREADCRUMB, { href: `/admin/orders/${order.id}`, label: order.orderNumber }]}
        actions={
          <Link
            href="/admin/returns/new"
            className={buttonVariants({ variant: "outline" })}
          >
            Change order
          </Link>
        }
      />

      {anyRemaining ? (
        <ReturnCreateForm
          orderId={order.id}
          orderNumber={order.orderNumber}
          orderTotal={toNumber(order.totalAmount)}
          lines={lines}
        />
      ) : (
        <Panel>
          <EmptyState
            title="Everything has already been returned"
            description="Every line on this order has been fully returned on an earlier return."
            action={
              <Link href="/admin/returns/new" className={buttonVariants()}>
                Choose another order
              </Link>
            }
          />
        </Panel>
      )}
    </>
  );
}
