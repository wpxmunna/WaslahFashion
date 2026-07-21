import { ReportBarChart } from "@/components/admin/report-bar-chart";
import { ReportDateRange } from "@/components/admin/report-date-range";
import { ReportTabs, SALES_REPORT_TABS } from "@/components/admin/report-tabs";
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
import { getSalesReport, parseDateRange, parseGranularity } from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sales report" };

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireStaff();

  const raw = await searchParams;
  const range = parseDateRange(raw);
  const granularity = parseGranularity(raw);
  const report = await getSalesReport(range, granularity);

  const query = `start=${range.startKey}&end=${range.endKey}&group=${granularity}`;
  const t = report.totals;

  return (
    <>
      <PageHeader
        title="Sales report"
        description={`${range.startKey} to ${range.endKey} · grouped by ${granularity}`}
        breadcrumb={[
          { href: "/admin/reports", label: "Sales reports" },
          { href: "/admin/reports/sales", label: "Sales" },
        ]}
      />

      <ReportTabs items={SALES_REPORT_TABS} active="/admin/reports/sales" query={query} />

      <Panel className="mb-6">
        <ReportDateRange
          start={range.startKey}
          end={range.endKey}
          granularity={granularity}
          showGranularity
          exportHref={`/admin/reports/export/sales?${query}`}
        />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatPrice(t.revenue)}
          hint={`${formatPrice(t.averagePerDay)} per day`}
        />
        <StatCard
          label="Orders"
          value={String(t.orders)}
          hint={`${t.ordersPerDay.toFixed(1)} per day`}
        />
        <StatCard
          label="Average order"
          value={formatPrice(t.averageOrderValue)}
          hint={`${formatPrice(t.smallestOrder)} – ${formatPrice(t.largestOrder)}`}
        />
        <StatCard
          label="Discounts given"
          value={formatPrice(t.discounts)}
          hint={`${formatPrice(t.shipping)} shipping charged`}
        />
      </div>

      {report.periods.length === 0 ? (
        <Panel className="mt-6">
          <EmptyState
            title="No orders in this range"
            description="Widen the date range to see trading activity."
          />
        </Panel>
      ) : (
        <div className="mt-6 space-y-6">
          <Panel title="Revenue by period">
            <div className="p-5">
              <ReportBarChart
                ariaLabel={`Revenue per ${granularity}`}
                data={report.periods.map((p) => ({
                  key: p.key,
                  label: p.label,
                  values: { revenue: p.revenue },
                }))}
                series={[{ key: "revenue", label: "Revenue", color: "var(--primary)" }]}
              />
            </div>
          </Panel>

          <Panel title="Breakdown">
            <DataTable>
              <THead>
                <Th>Period</Th>
                <Th align="right">Orders</Th>
                <Th align="right">Subtotal</Th>
                <Th align="right">Discounts</Th>
                <Th align="right">Shipping</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">Average order</Th>
              </THead>
              <TBody>
                {report.periods.map((p) => (
                  <tr key={p.key} className="hover:bg-secondary/40">
                    <Td>{p.label}</Td>
                    <Td align="right" className="tabular-nums">
                      {p.orders}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(p.subtotal)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(p.discounts)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(p.shipping)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(p.revenue)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(p.orders > 0 ? p.revenue / p.orders : 0)}
                    </Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/40 font-medium">
                  <Td>Total</Td>
                  <Td align="right" className="tabular-nums">
                    {t.orders}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(t.subtotal)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(t.discounts)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(t.shipping)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(t.revenue)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(t.averageOrderValue)}
                  </Td>
                </tr>
              </TBody>
            </DataTable>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title="By order status"
              description="All statuses — revenue above excludes cancelled and refunded"
            >
              <DataTable>
                <THead>
                  <Th>Status</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Value</Th>
                </THead>
                <TBody>
                  {report.byStatus.map((s) => (
                    <tr key={s.status} className="hover:bg-secondary/40">
                      <Td>
                        <StatusBadge status={s.status} />
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {s.orders}
                      </Td>
                      <Td
                        align="right"
                        className={cn(
                          "tabular-nums",
                          (s.status === "CANCELLED" || s.status === "REFUNDED") &&
                            "text-muted-foreground",
                        )}
                      >
                        {formatPrice(s.revenue)}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </Panel>

            <Panel title="By payment method">
              <DataTable>
                <THead>
                  <Th>Method</Th>
                  <Th align="right">Orders</Th>
                  <Th align="right">Revenue</Th>
                </THead>
                <TBody>
                  {report.byPaymentMethod.map((m) => (
                    <tr key={m.method} className="hover:bg-secondary/40">
                      <Td className="capitalize">
                        {m.method.replace(/_/g, " ").toLowerCase()}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {m.orders}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {formatPrice(m.revenue)}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
