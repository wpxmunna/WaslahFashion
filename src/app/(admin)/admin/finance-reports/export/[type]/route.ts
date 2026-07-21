import type { NextRequest } from "next/server";

import { requireAdmin } from "@/lib/admin/guard";
import {
  csvMoney,
  csvResponse,
  getCashFlow,
  getExpenseReport,
  getProfitLoss,
  parseDateRange,
  parseGranularity,
  type CsvRow,
} from "@/lib/queries/reports";

const TYPES = ["profit-loss", "cash-flow", "expenses"] as const;
type ReportType = (typeof TYPES)[number];

function isReportType(value: string): value is ReportType {
  return (TYPES as readonly string[]).includes(value);
}

/**
 * CSV export for the financial reports.
 *
 * Fields are escaped by `csvField()` (quote anything containing a comma, quote
 * or newline; double embedded quotes), which the legacy PHP exporter left to
 * `fputcsv`. Money is emitted as a bare two-decimal number rather than
 * `formatPrice()` output, so a spreadsheet reads it as a number.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  // Same full-admin gate as the report screens themselves — a route handler is
  // not covered by the admin layout.
  await requireAdmin();

  const { type } = await params;
  if (!isReportType(type)) {
    return new Response("Unknown report type", { status: 404 });
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const range = parseDateRange(raw);
  const rows: CsvRow[] = [];

  if (type === "profit-loss") {
    const pl = await getProfitLoss(range);
    rows.push(["Profit & loss", `${range.startKey} to ${range.endKey}`]);
    rows.push([]);
    rows.push(["Section", "Line", "Amount"]);
    rows.push(["Revenue", "Gross sales", csvMoney(pl.grossSales)]);
    rows.push(["Revenue", "Discounts given", csvMoney(-pl.discounts)]);
    rows.push(["Revenue", "Shipping charged", csvMoney(pl.shipping)]);
    rows.push(["Revenue", "Tax collected", csvMoney(-pl.taxCollected)]);
    rows.push(["Revenue", "Net revenue", csvMoney(pl.netRevenue)]);
    rows.push(["Revenue", "Orders", pl.orderCount]);
    rows.push([]);
    rows.push(["Cost of goods sold", "Cost of goods sold", csvMoney(-pl.cogs)]);
    rows.push(["Cost of goods sold", "Units sold", pl.unitsSold]);
    rows.push(["Gross profit", "Gross profit", csvMoney(pl.grossProfit)]);
    rows.push(["Gross profit", "Gross margin %", pl.grossMargin.toFixed(2)]);
    rows.push([]);
    rows.push(["Operating expenses", "Category", "Amount"]);
    for (const expense of pl.expenses) {
      rows.push(["Operating expenses", expense.category, csvMoney(expense.amount)]);
    }
    rows.push(["Operating expenses", "Total expenses", csvMoney(-pl.totalExpenses)]);
    rows.push([]);
    rows.push(["Net profit", "Net profit", csvMoney(pl.netProfit)]);
    rows.push(["Net profit", "Net margin %", pl.netMargin.toFixed(2)]);
  }

  if (type === "cash-flow") {
    const granularity = parseGranularity(raw);
    const report = await getCashFlow(range, granularity);
    rows.push(["Cash flow", `${range.startKey} to ${range.endKey}`, `grouped by ${granularity}`]);
    rows.push([]);
    rows.push([
      "Period",
      "Cash in",
      "Expenses paid",
      "Supplier payments",
      "Refunds",
      "Cash out",
      "Net",
      "Running balance",
    ]);
    for (const p of report.periods) {
      rows.push([
        p.label,
        csvMoney(p.cashIn),
        csvMoney(p.expensesPaid),
        csvMoney(p.supplierPayments),
        csvMoney(p.refunds),
        csvMoney(p.cashOut),
        csvMoney(p.net),
        csvMoney(p.running),
      ]);
    }
    rows.push([
      "Total",
      csvMoney(report.totals.cashIn),
      csvMoney(report.totals.expensesPaid),
      csvMoney(report.totals.supplierPayments),
      csvMoney(report.totals.refunds),
      csvMoney(report.totals.cashOut),
      csvMoney(report.totals.net),
      "",
    ]);
  }

  if (type === "expenses") {
    const report = await getExpenseReport(range);
    rows.push(["Expense report", `${range.startKey} to ${range.endKey}`]);
    rows.push([]);
    rows.push(["Category", "Items", "Total", "Share %"]);
    for (const c of report.byCategory) {
      rows.push([c.category, c.count, csvMoney(c.amount), c.share.toFixed(2)]);
    }
    rows.push(["Total", report.count, csvMoney(report.total), "100.00"]);
    rows.push([]);
    rows.push(["Month", "Items", "Total", "Share %"]);
    for (const m of report.byMonth) {
      rows.push([m.label, m.count, csvMoney(m.amount), m.share.toFixed(2)]);
    }
    rows.push([]);
    rows.push(["Payment status", "Items", "Total"]);
    for (const s of report.byStatus) {
      rows.push([s.status, s.count, csvMoney(s.amount)]);
    }
    rows.push([]);
    rows.push(["Summary", "Average", csvMoney(report.average)]);
    rows.push(["Summary", "Highest", csvMoney(report.highest)]);
    rows.push(["Summary", "Lowest", csvMoney(report.lowest)]);
  }

  return csvResponse(rows, `${type}-${range.startKey}-to-${range.endKey}.csv`);
}
