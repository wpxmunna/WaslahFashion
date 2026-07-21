import Link from "next/link";
import { Package, ShoppingCart, TrendingUp, Users } from "lucide-react";

import { ReportDateRange } from "@/components/admin/report-date-range";
import { ReportTabs, SALES_REPORT_TABS } from "@/components/admin/report-tabs";
import { RevenueSparkline } from "@/components/admin/revenue-sparkline";
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
import { requireStaff } from "@/lib/admin/guard";
import { formatPrice } from "@/lib/money";
import {
  getProductReport,
  getSalesReport,
  getSalesOverview,
  parseDateRange,
} from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sales reports" };

export default async function ReportsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Sales reporting is open to managers as well as full admins.
  await requireStaff();

  const raw = await searchParams;
  const range = parseDateRange(raw);

  const [overview, sales, products] = await Promise.all([
    getSalesOverview(range),
    getSalesReport(range, "day"),
    getProductReport(range),
  ]);

  const query = `start=${range.startKey}&end=${range.endKey}`;
  const change = overview.revenueChange;

  return (
    <>
      <PageHeader
        title="Sales reports"
        description="Trading performance over a date range."
      />

      <ReportTabs items={SALES_REPORT_TABS} active="/admin/reports" query={query} />

      <Panel className="mb-6">
        <ReportDateRange start={range.startKey} end={range.endKey} />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatPrice(overview.revenue)}
          hint={
            change === null
              ? `vs ${formatPrice(overview.priorRevenue)} in the previous ${range.days} days`
              : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs the previous ${range.days} days`
          }
          icon={<TrendingUp className="size-4" strokeWidth={1.7} />}
        />
        <StatCard
          label="Orders"
          value={String(overview.orders)}
          hint={`${formatPrice(overview.averageOrderValue)} average order`}
          icon={<ShoppingCart className="size-4" strokeWidth={1.7} />}
        />
        <StatCard
          label="Units sold"
          value={String(overview.unitsSold)}
          hint={`${products.totals.distinctProducts} distinct products`}
          icon={<Package className="size-4" strokeWidth={1.7} />}
          href={`/admin/reports/products?${query}`}
        />
        <StatCard
          label="New customers"
          value={String(overview.newCustomers)}
          hint="Registered in this range"
          icon={<Users className="size-4" strokeWidth={1.7} />}
          href={`/admin/reports/customers?${query}`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Revenue" description="Daily, across the range" className="xl:col-span-2">
          <div className="p-5">
            <RevenueSparkline data={overview.series} />
          </div>
        </Panel>

        <Panel title="Orders by status" description="Every status, including cancellations">
          {sales.byStatus.length === 0 ? (
            <EmptyState title="No orders in this range" />
          ) : (
            <ul className="divide-y divide-border">
              {sales.byStatus.map((s) => (
                <li
                  key={s.status}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="flex items-center gap-2">
                    <StatusBadge status={s.status} />
                    <span className="text-xs text-muted-foreground">
                      {s.orders} order{s.orders === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm tabular-nums",
                      (s.status === "CANCELLED" || s.status === "REFUNDED") &&
                        "text-muted-foreground line-through",
                    )}
                  >
                    {formatPrice(s.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          title="Best sellers"
          description="By units sold in this range"
          className="xl:col-span-2"
          actions={
            <Link href={`/admin/reports/products?${query}`} className="link-wipe text-sm">
              Full product report
            </Link>
          }
        >
          {products.best.length === 0 ? (
            <EmptyState title="Nothing sold in this range" />
          ) : (
            <DataTable>
              <THead>
                <Th>Product</Th>
                <Th align="right">Units</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">Stock</Th>
              </THead>
              <TBody>
                {products.best.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="link-wipe block truncate"
                      >
                        {p.name}
                      </Link>
                      {p.sku && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {p.sku}
                        </span>
                      )}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {p.units}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(p.revenue)}
                    </Td>
                    <Td
                      align="right"
                      className={cn("tabular-nums", p.stock <= 0 && "text-destructive")}
                    >
                      {p.stock}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>

        <Panel title="Payment methods">
          {sales.byPaymentMethod.length === 0 ? (
            <EmptyState title="No payments in this range" />
          ) : (
            <ul className="divide-y divide-border">
              {sales.byPaymentMethod.map((m) => (
                <li key={m.method} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm capitalize">
                      {m.method.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      {formatPrice(m.revenue)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.orders} order{m.orders === 1 ? "" : "s"}
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
