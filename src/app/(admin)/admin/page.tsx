import Link from "next/link";
import {
  AlertTriangle,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

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
import { RevenueSparkline } from "@/components/admin/revenue-sparkline";
import { formatPrice } from "@/lib/money";
import { getDashboardStats, getRevenueSeries } from "@/lib/queries/admin-dashboard";

export default async function AdminDashboardPage() {
  const [stats, series] = await Promise.all([getDashboardStats(), getRevenueSeries(14)]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Trading summary across the store."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (month)"
          value={formatPrice(stats.revenue.month)}
          hint={`${formatPrice(stats.revenue.today)} today`}
          icon={<TrendingUp className="size-4" strokeWidth={1.7} />}
        />
        <StatCard
          label="Orders"
          value={String(stats.orders.total)}
          hint={`${stats.orders.today} today · ${stats.orders.pending} pending`}
          icon={<ShoppingCart className="size-4" strokeWidth={1.7} />}
          href="/admin/orders"
        />
        <StatCard
          label="Customers"
          value={String(stats.customerCount)}
          icon={<Users className="size-4" strokeWidth={1.7} />}
          href="/admin/customers"
        />
        <StatCard
          label="Active products"
          value={String(stats.productCount)}
          hint={`${stats.lowStock.length} low on stock`}
          icon={<Package className="size-4" strokeWidth={1.7} />}
          href="/admin/products"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Revenue, last 14 days"
          className="xl:col-span-2"
        >
          <div className="p-5">
            <RevenueSparkline data={series} />
          </div>
        </Panel>

        <Panel
          title="Low stock"
          description="At or below the reorder threshold"
        >
          {stats.lowStock.length === 0 ? (
            <EmptyState title="Nothing running low" />
          ) : (
            <ul className="divide-y divide-border">
              {stats.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="link-wipe truncate text-sm"
                  >
                    {p.name}
                  </Link>
                  <span
                    className={`shrink-0 text-sm tabular-nums ${
                      p.stock_quantity <= 0 ? "text-destructive" : "text-amber-600"
                    }`}
                  >
                    {p.stock_quantity <= 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="size-3.5" strokeWidth={1.8} />
                        Out
                      </span>
                    ) : (
                      `${p.stock_quantity} left`
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Recent orders"
          className="xl:col-span-2"
          actions={
            <Link href="/admin/orders" className="link-wipe text-sm">
              View all
            </Link>
          }
        >
          {stats.recentOrders.length === 0 ? (
            <EmptyState title="No orders yet" />
          ) : (
            <DataTable>
              <THead>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Status</Th>
                <Th align="right">Total</Th>
              </THead>
              <TBody>
                {stats.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="link-wipe tabular-nums"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {order.createdAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">
                      {order.user?.name ?? order.shippingName ?? "Guest"}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={order.status} />
                        <StatusBadge status={order.paymentStatus} />
                      </div>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(order.totalAmount)}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>

        <Panel title="Best sellers" description="By units sold">
          {stats.topProducts.length === 0 ? (
            <EmptyState title="No sales yet" />
          ) : (
            <ul className="divide-y divide-border">
              {stats.topProducts.map((p) => (
                <li key={p.productId} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm">{p.name}</span>
                    <span className="shrink-0 text-sm tabular-nums">{p.units}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {formatPrice(p.revenue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
