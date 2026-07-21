import Link from "next/link";
import { Coins, PiggyBank, Receipt, TrendingUp } from "lucide-react";

import { ReportDateRange } from "@/components/admin/report-date-range";
import { FINANCE_REPORT_TABS, ReportTabs } from "@/components/admin/report-tabs";
import { PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { formatPrice } from "@/lib/money";
import {
  getCashFlow,
  getExpenseReport,
  getProfitLoss,
  parseDateRange,
} from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "Financial reports" };

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Financial reports are full-admin only, matching the legacy
  // `requireFullAdmin()` gate on AdminFinanceReportController.
  await requireAdmin();

  const raw = await searchParams;
  const range = parseDateRange(raw);

  const [pl, cash, expenses] = await Promise.all([
    getProfitLoss(range),
    getCashFlow(range, "day"),
    getExpenseReport(range),
  ]);

  const query = `start=${range.startKey}&end=${range.endKey}`;

  const cards = [
    {
      href: `/admin/finance-reports/profit-loss?${query}`,
      title: "Profit & loss",
      body: "Revenue, cost of goods sold and operating expenses for the period.",
      figure: formatPrice(pl.netProfit),
      caption: `Net profit · ${pl.netMargin.toFixed(1)}% margin`,
    },
    {
      href: `/admin/finance-reports/cash-flow?${query}`,
      title: "Cash flow",
      body: "Settled money in against settled money out, with a running balance.",
      figure: formatPrice(cash.totals.net),
      caption: `${formatPrice(cash.totals.cashIn)} in · ${formatPrice(cash.totals.cashOut)} out`,
    },
    {
      href: `/admin/finance-reports/expenses?${query}`,
      title: "Expenses",
      body: "Spending by category and by month, with each category's share.",
      figure: formatPrice(expenses.total),
      caption: `${expenses.count} expense${expenses.count === 1 ? "" : "s"} recorded`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Financial reports"
        description="Profit and loss, cash flow and expense analysis."
      />

      <ReportTabs items={FINANCE_REPORT_TABS} active="/admin/finance-reports" query={query} />

      <Panel className="mb-6">
        <ReportDateRange start={range.startKey} end={range.endKey} />
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Revenue excludes cancelled and refunded orders throughout. Profit and loss is
          accrual (dated by order), cash flow is cash-basis (settled payments only), so the
          two will not agree.
        </p>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={formatPrice(pl.netRevenue)}
          hint={`${pl.orderCount} order${pl.orderCount === 1 ? "" : "s"}`}
          icon={<TrendingUp className="size-4" strokeWidth={1.7} />}
        />
        <StatCard
          label="Gross profit"
          value={formatPrice(pl.grossProfit)}
          hint={`${pl.grossMargin.toFixed(1)}% margin after COGS`}
          icon={<Coins className="size-4" strokeWidth={1.7} />}
        />
        <StatCard
          label="Operating expenses"
          value={formatPrice(pl.totalExpenses)}
          hint={`${pl.expenses.length} categor${pl.expenses.length === 1 ? "y" : "ies"}`}
          icon={<Receipt className="size-4" strokeWidth={1.7} />}
        />
        <StatCard
          label="Net profit"
          value={formatPrice(pl.netProfit)}
          hint={`${pl.netMargin.toFixed(1)}% of net revenue`}
          icon={<PiggyBank className="size-4" strokeWidth={1.7} />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <p className="font-display text-lg">{card.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{card.body}</p>
            <p className="mt-4 font-display text-2xl tabular-nums">{card.figure}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.caption}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
