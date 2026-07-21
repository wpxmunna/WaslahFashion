import { ReportBarChart } from "@/components/admin/report-bar-chart";
import { ReportDateRange } from "@/components/admin/report-date-range";
import { FINANCE_REPORT_TABS, ReportTabs } from "@/components/admin/report-tabs";
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
import { requireAdmin } from "@/lib/admin/guard";
import { formatPrice } from "@/lib/money";
import { getCashFlow, parseDateRange, parseGranularity } from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cash flow" };

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const range = parseDateRange(raw);
  const granularity = parseGranularity(raw);
  const report = await getCashFlow(range, granularity);

  const query = `start=${range.startKey}&end=${range.endKey}&group=${granularity}`;

  return (
    <>
      <PageHeader
        title="Cash flow"
        description={`${range.startKey} to ${range.endKey} · settled money only`}
        breadcrumb={[
          { href: "/admin/finance-reports", label: "Financial reports" },
          { href: "/admin/finance-reports/cash-flow", label: "Cash flow" },
        ]}
      />

      <ReportTabs
        items={FINANCE_REPORT_TABS}
        active="/admin/finance-reports/cash-flow"
        query={query}
      />

      <Panel className="mb-6">
        <ReportDateRange
          start={range.startKey}
          end={range.endKey}
          granularity={granularity}
          showGranularity
          exportHref={`/admin/finance-reports/export/cash-flow?${query}`}
        />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cash in"
          value={formatPrice(report.totals.cashIn)}
          hint="Paid orders"
        />
        <StatCard
          label="Cash out"
          value={formatPrice(report.totals.cashOut)}
          hint="Expenses, suppliers and refunds"
        />
        <StatCard
          label="Net cash flow"
          value={formatPrice(report.totals.net)}
          hint={report.totals.net >= 0 ? "Cash positive" : "Cash negative"}
        />
        <StatCard
          label="Supplier payments"
          value={formatPrice(report.totals.supplierPayments)}
          hint={`${formatPrice(report.totals.refunds)} refunded to customers`}
        />
      </div>

      <div className="mt-6 space-y-6">
        <Panel title="Money in and out">
          <div className="p-5">
            {report.periods.length === 0 ? (
              <EmptyState
                title="No settled movements"
                description="Nothing was paid in or out during this range."
              />
            ) : (
              <ReportBarChart
                ariaLabel="Cash in against cash out per period"
                data={report.periods.map((p) => ({
                  key: p.key,
                  label: p.label,
                  values: { in: p.cashIn, out: p.cashOut },
                }))}
                series={[
                  { key: "in", label: "Cash in", color: "var(--primary)" },
                  { key: "out", label: "Cash out", color: "var(--destructive)" },
                ]}
              />
            )}
          </div>
        </Panel>

        <Panel
          title="By period"
          description="Running balance is cumulative across the range, starting at zero — it is not an opening bank balance."
        >
          {report.periods.length === 0 ? (
            <EmptyState title="Nothing to show" />
          ) : (
            <DataTable>
              <THead>
                <Th>Period</Th>
                <Th align="right">Cash in</Th>
                <Th align="right">Expenses</Th>
                <Th align="right">Suppliers</Th>
                <Th align="right">Refunds</Th>
                <Th align="right">Net</Th>
                <Th align="right">Running</Th>
              </THead>
              <TBody>
                {report.periods.map((p) => (
                  <tr key={p.key} className="hover:bg-secondary/40">
                    <Td>{p.label}</Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(p.cashIn)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(p.expensesPaid)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(p.supplierPayments)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(p.refunds)}
                    </Td>
                    <Td
                      align="right"
                      className={cn("tabular-nums", p.net < 0 && "text-destructive")}
                    >
                      {formatPrice(p.net)}
                    </Td>
                    <Td
                      align="right"
                      className={cn(
                        "tabular-nums font-medium",
                        p.running < 0 && "text-destructive",
                      )}
                    >
                      {formatPrice(p.running)}
                    </Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/40 font-medium">
                  <Td>Total</Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(report.totals.cashIn)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(report.totals.expensesPaid)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(report.totals.supplierPayments)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(report.totals.refunds)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(report.totals.net)}
                  </Td>
                  <Td />
                </tr>
              </TBody>
            </DataTable>
          )}
        </Panel>

        <Panel title="What counts as cash">
          <ul className="space-y-2 p-5 text-xs text-muted-foreground">
            <li>
              Cash in: orders with a payment status of paid, excluding cancelled and
              refunded orders, dated by order date.
            </li>
            <li>
              Cash out: expenses marked paid (dated by expense date), supplier payments
              (by payment date) and customer refunds whose refund status is completed.
            </li>
            <li>
              Partly-paid expenses are excluded entirely — only the fully-settled ones
              count, so this understates cash out where partial payments are used.
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
