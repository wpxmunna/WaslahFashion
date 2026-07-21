import { ShareBar } from "@/components/admin/report-bar-chart";
import { ReportDateRange } from "@/components/admin/report-date-range";
import { FINANCE_REPORT_TABS, ReportTabs } from "@/components/admin/report-tabs";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { formatPrice } from "@/lib/money";
import { getProfitLoss, parseDateRange } from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Profit & loss" };

function Row({
  label,
  value,
  hint,
  emphasis,
  negative,
  indent,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  negative?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 px-5 py-3",
        emphasis && "bg-secondary/40 font-medium",
      )}
    >
      <span className={cn("text-sm", indent && "pl-4 text-muted-foreground")}>
        {label}
        {hint && <span className="ml-2 text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 text-sm tabular-nums",
          emphasis && "font-display text-base",
          negative && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const range = parseDateRange(raw);
  const pl = await getProfitLoss(range);

  const query = `start=${range.startKey}&end=${range.endKey}`;

  return (
    <>
      <PageHeader
        title="Profit & loss"
        description={`${range.startKey} to ${range.endKey} · ${range.days} day${range.days === 1 ? "" : "s"}`}
        breadcrumb={[
          { href: "/admin/finance-reports", label: "Financial reports" },
          { href: "/admin/finance-reports/profit-loss", label: "Profit & loss" },
        ]}
      />

      <ReportTabs
        items={FINANCE_REPORT_TABS}
        active="/admin/finance-reports/profit-loss"
        query={query}
      />

      <Panel className="mb-6">
        <ReportDateRange
          start={range.startKey}
          end={range.endKey}
          exportHref={`/admin/finance-reports/export/profit-loss?${query}`}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Statement">
          <div className="divide-y divide-border">
            <Row label="Gross sales" value={formatPrice(pl.grossSales)} hint="before discounts" />
            <Row
              label="Discounts given"
              value={`− ${formatPrice(pl.discounts)}`}
              indent
            />
            <Row label="Shipping charged" value={formatPrice(pl.shipping)} indent />
            <Row
              label="Tax collected"
              value={`− ${formatPrice(pl.taxCollected)}`}
              hint="not revenue"
              indent
            />
            <Row
              label="Net revenue"
              value={formatPrice(pl.netRevenue)}
              hint={`${pl.orderCount} order${pl.orderCount === 1 ? "" : "s"}`}
              emphasis
            />

            <Row
              label="Cost of goods sold"
              value={`− ${formatPrice(pl.cogs)}`}
              hint={`${pl.unitsSold} unit${pl.unitsSold === 1 ? "" : "s"}`}
            />
            <Row
              label="Gross profit"
              value={formatPrice(pl.grossProfit)}
              hint={`${pl.grossMargin.toFixed(1)}% margin`}
              emphasis
              negative={pl.grossProfit < 0}
            />

            <Row
              label="Operating expenses"
              value={`− ${formatPrice(pl.totalExpenses)}`}
            />
            {pl.expenses.map((expense) => (
              <Row
                key={expense.categoryId ?? "none"}
                label={expense.category}
                value={formatPrice(expense.amount)}
                hint={`${expense.count} item${expense.count === 1 ? "" : "s"}`}
                indent
              />
            ))}

            <Row
              label="Net profit"
              value={formatPrice(pl.netProfit)}
              hint={`${pl.netMargin.toFixed(1)}% of net revenue`}
              emphasis
              negative={pl.netProfit < 0}
            />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Expense mix" description="Share of operating expenses">
            {pl.expenses.length === 0 ? (
              <EmptyState
                title="No expenses"
                description="No paid or partly-paid expenses fall in this range."
              />
            ) : (
              <ul className="divide-y divide-border">
                {pl.expenses.map((expense) => {
                  const share =
                    pl.totalExpenses > 0 ? (expense.amount / pl.totalExpenses) * 100 : 0;
                  return (
                    <li key={expense.categoryId ?? "none"} className="px-5 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm">{expense.category}</span>
                        <span className="shrink-0 text-sm tabular-nums">
                          {formatPrice(expense.amount)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <ShareBar percent={share} />
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {share.toFixed(1)}%
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="How this is calculated">
            <ul className="space-y-2 p-5 text-xs text-muted-foreground">
              <li>Revenue excludes cancelled and refunded orders.</li>
              <li>
                Orders count on their order date regardless of whether payment has
                settled — this is an accrual statement.
              </li>
              <li>
                Cost of goods sold is each order line&apos;s quantity times the
                product&apos;s <em>current</em> cost price. Order items store no cost
                snapshot, so changing a product&apos;s cost restates past periods.
              </li>
              <li>Only expenses that are paid or partly paid are counted.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
