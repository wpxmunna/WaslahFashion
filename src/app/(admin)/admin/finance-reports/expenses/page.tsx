import { ReportBarChart, ShareBar } from "@/components/admin/report-bar-chart";
import { ReportDateRange } from "@/components/admin/report-date-range";
import { FINANCE_REPORT_TABS, ReportTabs } from "@/components/admin/report-tabs";
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
import { requireAdmin } from "@/lib/admin/guard";
import { formatPrice } from "@/lib/money";
import { getExpenseReport, parseDateRange } from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "Expense report" };

export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const range = parseDateRange(raw);
  const report = await getExpenseReport(range);

  const query = `start=${range.startKey}&end=${range.endKey}`;

  return (
    <>
      <PageHeader
        title="Expense report"
        description={`${range.startKey} to ${range.endKey} · every payment status included`}
        breadcrumb={[
          { href: "/admin/finance-reports", label: "Financial reports" },
          { href: "/admin/finance-reports/expenses", label: "Expenses" },
        ]}
      />

      <ReportTabs
        items={FINANCE_REPORT_TABS}
        active="/admin/finance-reports/expenses"
        query={query}
      />

      <Panel className="mb-6">
        <ReportDateRange
          start={range.startKey}
          end={range.endKey}
          exportHref={`/admin/finance-reports/export/expenses?${query}`}
        />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total spend"
          value={formatPrice(report.total)}
          hint={`${report.count} expense${report.count === 1 ? "" : "s"}`}
        />
        <StatCard label="Average" value={formatPrice(report.average)} hint="Per expense" />
        <StatCard label="Largest" value={formatPrice(report.highest)} />
        <StatCard
          label="Categories"
          value={String(report.byCategory.length)}
          hint="With spend in this range"
        />
      </div>

      {report.count === 0 ? (
        <Panel className="mt-6">
          <EmptyState
            title="No expenses in this range"
            description="Widen the date range, or record expenses from the Expenses screen."
          />
        </Panel>
      ) : (
        <div className="mt-6 space-y-6">
          <Panel title="Monthly trend">
            <div className="p-5">
              <ReportBarChart
                ariaLabel="Expenses per month"
                data={report.byMonth.map((m) => ({
                  key: m.month,
                  label: m.label,
                  values: { amount: m.amount },
                }))}
                series={[
                  { key: "amount", label: "Expenses", color: "var(--primary)" },
                ]}
              />
            </div>
          </Panel>

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel title="By category" className="xl:col-span-2">
              <DataTable>
                <THead>
                  <Th>Category</Th>
                  <Th align="right">Items</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Share</Th>
                </THead>
                <TBody>
                  {report.byCategory.map((c) => (
                    <tr key={c.categoryId ?? "none"} className="hover:bg-secondary/40">
                      <Td>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.category}
                        </span>
                      </Td>
                      <Td align="right" className="tabular-nums text-muted-foreground">
                        {c.count}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {formatPrice(c.amount)}
                      </Td>
                      <Td align="right">
                        <span className="flex items-center justify-end gap-2">
                          <ShareBar percent={c.share} className="w-20" />
                          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            {c.share.toFixed(1)}%
                          </span>
                        </span>
                      </Td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-secondary/40 font-medium">
                    <Td>Total</Td>
                    <Td align="right" className="tabular-nums">
                      {report.count}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(report.total)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      100.0%
                    </Td>
                  </tr>
                </TBody>
              </DataTable>
            </Panel>

            <div className="space-y-6">
              <Panel title="By month">
                <ul className="divide-y divide-border">
                  {report.byMonth.map((m) => (
                    <li key={m.month} className="px-5 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm">{m.label}</span>
                        <span className="shrink-0 text-sm tabular-nums">
                          {formatPrice(m.amount)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <ShareBar percent={m.share} />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {m.share.toFixed(1)}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel
                title="By payment status"
                description="Unpaid spend is committed but has not left the bank"
              >
                <ul className="divide-y divide-border">
                  {report.byStatus.map((s) => (
                    <li
                      key={s.status}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <StatusBadge status={s.status} />
                        <span className="text-xs text-muted-foreground">
                          {s.count} item{s.count === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">
                        {formatPrice(s.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
