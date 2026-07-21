import type { NextRequest } from "next/server";

import { requireStaff } from "@/lib/admin/guard";
import {
  csvMoney,
  csvResponse,
  getCustomerReport,
  getProductReport,
  getSalesReport,
  parseDateRange,
  parseGranularity,
  type CsvRow,
} from "@/lib/queries/reports";

const TYPES = ["sales", "products", "customers"] as const;
type ReportType = (typeof TYPES)[number];

function isReportType(value: string): value is ReportType {
  return (TYPES as readonly string[]).includes(value);
}

function isoDate(date: Date | null): string {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

/**
 * CSV export for the sales reports. Same escaping rules as the finance
 * exports — see `csvField()` in `lib/queries/reports.ts`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  await requireStaff();

  const { type } = await params;
  if (!isReportType(type)) {
    return new Response("Unknown report type", { status: 404 });
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const range = parseDateRange(raw);
  const rows: CsvRow[] = [];

  if (type === "sales") {
    const granularity = parseGranularity(raw);
    const report = await getSalesReport(range, granularity);
    rows.push([
      "Period",
      "Orders",
      "Subtotal",
      "Discounts",
      "Shipping",
      "Tax",
      "Revenue",
      "Average order",
    ]);
    for (const p of report.periods) {
      rows.push([
        p.label,
        p.orders,
        csvMoney(p.subtotal),
        csvMoney(p.discounts),
        csvMoney(p.shipping),
        csvMoney(p.tax),
        csvMoney(p.revenue),
        csvMoney(p.orders > 0 ? p.revenue / p.orders : 0),
      ]);
    }
    const t = report.totals;
    rows.push([
      "Total",
      t.orders,
      csvMoney(t.subtotal),
      csvMoney(t.discounts),
      csvMoney(t.shipping),
      csvMoney(t.tax),
      csvMoney(t.revenue),
      csvMoney(t.averageOrderValue),
    ]);
    rows.push([]);
    rows.push(["Order status", "Orders", "Value"]);
    for (const s of report.byStatus) {
      rows.push([s.status, s.orders, csvMoney(s.revenue)]);
    }
    rows.push([]);
    rows.push(["Payment method", "Orders", "Revenue"]);
    for (const m of report.byPaymentMethod) {
      rows.push([m.method, m.orders, csvMoney(m.revenue)]);
    }
  }

  if (type === "products") {
    const report = await getProductReport(range);
    rows.push([
      "Product",
      "SKU",
      "Units sold",
      "Revenue",
      "Cost",
      "Margin",
      "Margin %",
      "Stock",
    ]);
    for (const p of report.products) {
      rows.push([
        p.name,
        p.sku ?? "",
        p.units,
        csvMoney(p.revenue),
        p.hasCost ? csvMoney(p.cost) : "",
        p.hasCost ? csvMoney(p.margin) : "",
        p.marginPercent !== null ? p.marginPercent.toFixed(2) : "",
        p.stock,
      ]);
    }
    const t = report.totals;
    rows.push([
      "Total",
      "",
      t.units,
      csvMoney(t.revenue),
      csvMoney(t.cost),
      csvMoney(t.margin),
      "",
      "",
    ]);
  }

  if (type === "customers") {
    const report = await getCustomerReport(range);
    rows.push([
      "Customer",
      "Email",
      "Orders (lifetime)",
      "Average order",
      "Lifetime spend",
      "Last order",
    ]);
    for (const c of report.topCustomers) {
      rows.push([
        c.name,
        c.email,
        c.orders,
        csvMoney(c.averageOrder),
        csvMoney(c.spent),
        isoDate(c.lastOrder),
      ]);
    }
    rows.push([]);
    rows.push(["Metric", "Value"]);
    rows.push(["New customers in range", report.newCustomers]);
    rows.push(["Returning customers in range", report.returningCustomers]);
    rows.push(["Guest orders in range", report.guestOrders]);
    rows.push(["Orders in range", report.orders]);
    rows.push(["Revenue in range", csvMoney(report.revenue)]);
    rows.push(["Average order value in range", csvMoney(report.averageOrderValue)]);
  }

  return csvResponse(rows, `${type}-report-${range.startKey}-to-${range.endKey}.csv`);
}
