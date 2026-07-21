import Link from "next/link";

import { ShareBar } from "@/components/admin/report-bar-chart";
import { ReportDateRange } from "@/components/admin/report-date-range";
import { ReportTabs, SALES_REPORT_TABS } from "@/components/admin/report-tabs";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { requireStaff } from "@/lib/admin/guard";
import { formatPrice } from "@/lib/money";
import { getCustomerReport, parseDateRange } from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "Customer report" };

export default async function CustomerReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireStaff();

  const raw = await searchParams;
  const range = parseDateRange(raw);
  const report = await getCustomerReport(range);

  const query = `start=${range.startKey}&end=${range.endKey}`;
  const active = report.activeCustomers;
  const newShare = active > 0 ? (report.newCustomers / active) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Customer report"
        description={`${range.startKey} to ${range.endKey}`}
        breadcrumb={[
          { href: "/admin/reports", label: "Sales reports" },
          { href: "/admin/reports/customers", label: "Customers" },
        ]}
      />

      <ReportTabs
        items={SALES_REPORT_TABS}
        active="/admin/reports/customers"
        query={query}
      />

      <Panel className="mb-6">
        <ReportDateRange
          start={range.startKey}
          end={range.endKey}
          exportHref={`/admin/reports/export/customers?${query}`}
        />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Customers who ordered"
          value={String(active)}
          hint={`${report.guestOrders} guest order${report.guestOrders === 1 ? "" : "s"} not counted`}
        />
        <StatCard
          label="New customers"
          value={String(report.newCustomers)}
          hint="First-ever order fell in this range"
        />
        <StatCard
          label="Returning customers"
          value={String(report.returningCustomers)}
          hint="Had ordered before this range"
        />
        <StatCard
          label="Average order value"
          value={formatPrice(report.averageOrderValue)}
          hint={`${report.orders} order${report.orders === 1 ? "" : "s"} · ${formatPrice(report.revenue)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="New versus returning">
          {active === 0 ? (
            <EmptyState title="No signed-in customers ordered in this range" />
          ) : (
            <div className="space-y-4 p-5">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">New</span>
                  <span className="text-sm tabular-nums">
                    {report.newCustomers} · {newShare.toFixed(1)}%
                  </span>
                </div>
                <ShareBar percent={newShare} className="mt-2" />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">Returning</span>
                  <span className="text-sm tabular-nums">
                    {report.returningCustomers} · {(100 - newShare).toFixed(1)}%
                  </span>
                </div>
                <ShareBar percent={100 - newShare} className="mt-2" />
              </div>
              <p className="text-xs text-muted-foreground">
                A customer is new when their first-ever order — across all time, not just
                this range — falls inside it. Guest orders carry no customer record and are
                excluded from both counts.
              </p>
            </div>
          )}
        </Panel>

        <Panel
          title="Top customers"
          description="By lifetime spend, all time"
          className="xl:col-span-2"
        >
          {report.topCustomers.length === 0 ? (
            <EmptyState title="No customer orders yet" />
          ) : (
            <DataTable>
              <THead>
                <Th>Customer</Th>
                <Th align="right">Orders</Th>
                <Th align="right">Average</Th>
                <Th align="right">Lifetime spend</Th>
                <Th>Last order</Th>
              </THead>
              <TBody>
                {report.topCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="link-wipe block truncate font-medium"
                      >
                        {c.name}
                      </Link>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {c.email}
                      </span>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {c.orders}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(c.averageOrder)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(c.spent)}
                    </Td>
                    <Td className="text-muted-foreground">
                      {c.lastOrder
                        ? new Date(c.lastOrder).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>
      </div>
    </>
  );
}
