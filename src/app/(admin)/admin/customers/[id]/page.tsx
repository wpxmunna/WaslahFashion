import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { CustomerActiveToggle } from "@/components/admin/customer-active-toggle";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

const REVENUE_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];
type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED";

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: user?.name ?? "Customer" };
}

export default async function AdminCustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) notFound();

  const customer = await prisma.user.findFirst({
    where: { id: userId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      addresses: { orderBy: [{ isDefault: "desc" }, { id: "asc" }] },
    },
  });

  // Staff accounts are managed on the Staff screen; this module is customers only.
  if (!customer || customer.role !== "CUSTOMER") notFound();

  const [orders, totalOrders, revenue] = await Promise.all([
    prisma.order.findMany({
      where: { userId, storeId: DEFAULT_STORE_ID },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { userId, storeId: DEFAULT_STORE_ID } }),
    prisma.order.aggregate({
      where: {
        userId,
        storeId: DEFAULT_STORE_ID,
        status: { in: REVENUE_STATUSES as OrderStatus[] },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  const totalSpent = toNumber(revenue._sum.totalAmount);
  const paidOrders = revenue._count._all;
  const averageOrder = paidOrders > 0 ? totalSpent / paidOrders : 0;

  return (
    <>
      <PageHeader
        title={customer.name}
        description={customer.email}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/customers", label: "Customers" },
        ]}
        actions={
          <>
            <StatusBadge status={customer.isActive ? "ACTIVE" : "INACTIVE"} />
            <CustomerActiveToggle userId={customer.id} isActive={customer.isActive} />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total orders"
          value={String(totalOrders)}
          hint={
            totalOrders === paidOrders
              ? undefined
              : `${totalOrders - paidOrders} cancelled or refunded`
          }
        />
        <StatCard
          label="Lifetime spend"
          value={formatPrice(totalSpent)}
          hint="Excludes cancelled and refunded orders."
        />
        <StatCard label="Average order" value={formatPrice(averageOrder)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Order history" description="The 25 most recent orders.">
          {orders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description="This customer has an account but has not ordered."
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Order</Th>
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

        <div className="space-y-6">
          <Panel title="Profile">
            <dl className="divide-y divide-border text-sm">
              {[
                { label: "Email", value: customer.email },
                { label: "Phone", value: customer.phone ?? "—" },
                {
                  label: "Email verified",
                  value: customer.emailVerifiedAt
                    ? format(customer.emailVerifiedAt, "d MMM yyyy")
                    : "Not verified",
                },
                {
                  label: "Last signed in",
                  value: customer.lastLoginAt
                    ? format(customer.lastLoginAt, "d MMM yyyy")
                    : "Never",
                },
                { label: "Joined", value: format(customer.createdAt, "d MMM yyyy") },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-4 px-5 py-3"
                >
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Addresses">
            {customer.addresses.length === 0 ? (
              <EmptyState
                title="No saved addresses"
                description="Addresses are saved at checkout."
              />
            ) : (
              <ul className="divide-y divide-border">
                {customer.addresses.map((a) => (
                  <li key={a.id} className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{a.label}</span>
                      {a.isDefault && <StatusBadge label="Default" tone="info" />}
                    </div>
                    <address className="mt-1.5 text-sm not-italic leading-relaxed text-muted-foreground">
                      <span className="block text-foreground">{a.name}</span>
                      <span className="block">{a.addressLine1}</span>
                      {a.addressLine2 && <span className="block">{a.addressLine2}</span>}
                      <span className="block">
                        {[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}
                      </span>
                      <span className="block">{a.country}</span>
                      {a.phone && <span className="mt-1 block">{a.phone}</span>}
                    </address>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
