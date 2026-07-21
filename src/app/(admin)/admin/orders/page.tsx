import Link from "next/link";
import { format } from "date-fns";

import { AdminSearch } from "@/components/admin/admin-search";
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
import { Pagination } from "@/components/pagination";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "Orders" };

const PER_PAGE = 20;

const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];

type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const status = first(raw.status);
  const payment = first(raw.payment);

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(status && ORDER_STATUSES.includes(status)
      ? { status: status as OrderStatus }
      : {}),
    ...(payment && PAYMENT_STATUSES.includes(payment)
      ? { paymentStatus: payment as PaymentStatus }
      : {}),
    ...(q
      ? {
          OR: [{ orderNumber: { contains: q } }, { shippingName: { contains: q } }],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        shippingName: true,
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (payment) query.set("payment", payment);

  const filtered = Boolean(q || status || payment);

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"}${filtered ? " match this view" : " placed so far"}.`}
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by order number or customer name"
            filters={[
              {
                name: "status",
                label: "Order status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "PENDING", label: "Pending" },
                  { value: "PROCESSING", label: "Processing" },
                  { value: "SHIPPED", label: "Shipped" },
                  { value: "DELIVERED", label: "Delivered" },
                  { value: "CANCELLED", label: "Cancelled" },
                  { value: "REFUNDED", label: "Refunded" },
                ],
              },
              {
                name: "payment",
                label: "Payment status",
                options: [
                  { value: "", label: "All payments" },
                  { value: "PENDING", label: "Awaiting payment" },
                  { value: "PAID", label: "Paid" },
                  { value: "FAILED", label: "Failed" },
                  { value: "REFUNDED", label: "Refunded" },
                ],
              },
            ]}
          />
        </div>

        {orders.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching orders" : "No orders yet"}
            description={
              filtered
                ? "Try a different search or clear the filters."
                : "Orders placed in the shop and at the POS will appear here."
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th align="right">Items</Th>
              <Th>Status</Th>
              <Th>Payment</Th>
              <Th align="right">Total</Th>
            </THead>
            <TBody>
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="link-wipe block font-medium"
                    >
                      {o.orderNumber}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {format(o.createdAt, "d MMM yyyy")}
                    </span>
                  </Td>
                  <Td>
                    {o.user ? (
                      <Link
                        href={`/admin/customers/${o.user.id}`}
                        className="link-wipe block truncate"
                      >
                        {o.user.name}
                      </Link>
                    ) : (
                      <span className="block truncate">
                        {o.shippingName ?? "Guest"}
                      </span>
                    )}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {o.user?.email ?? "Guest checkout"}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {o._count.items}
                  </Td>
                  <Td>
                    <StatusBadge status={o.status} />
                  </Td>
                  <Td>
                    <StatusBadge status={o.paymentStatus} />
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(o.totalAmount)}
                  </Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        )}
      </Panel>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        baseQuery={query.toString()}
        basePath="/admin/orders"
      />
    </>
  );
}
