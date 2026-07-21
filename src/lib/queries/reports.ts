import "server-only";

import { Prisma } from "@/generated/prisma";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";

/* =========================================================================
   Shared plumbing
   ========================================================================= */

/**
 * Revenue everywhere in these reports excludes cancelled and refunded orders,
 * matching `getDashboardStats()` and the legacy `FinancialReport` model. It
 * deliberately does *not* filter on payment status — an unpaid but delivered
 * order is still revenue on an accrual basis.
 */
const REVENUE_STATUSES = {
  notIn: ["CANCELLED", "REFUNDED"],
} satisfies Prisma.EnumOrderStatusFilter;

/** Same predicate, for the raw-SQL paths. */
const REVENUE_SQL = Prisma.sql`o.status NOT IN ('CANCELLED', 'REFUNDED')`;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type DateRange = {
  /** `YYYY-MM-DD`, inclusive. */
  startKey: string;
  /** `YYYY-MM-DD`, inclusive. */
  endKey: string;
  /** Local midnight at the start of the first day. */
  start: Date;
  /** Local midnight at the start of the last day — for `@db.Date` columns. */
  end: Date;
  /** Local midnight after the last day — for `DateTime` columns (`< endExclusive`). */
  endExclusive: Date;
  /** Inclusive day count. */
  days: number;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function toDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function fromDateKey(key: string | undefined): Date | null {
  if (!key || !DATE_KEY.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Rejects 2026-02-31 and friends, which `new Date` would silently roll over.
  return date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

const MS_PER_DAY = 86_400_000;

/**
 * Reads `?start=` / `?end=` and falls back to the current calendar month.
 * A reversed range is swapped rather than returning nothing.
 */
export function parseDateRange(raw: RawSearchParams): DateRange {
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let start = fromDateKey(first(raw.start)) ?? defaultStart;
  let end = fromDateKey(first(raw.end)) ?? defaultEnd;
  if (start > end) [start, end] = [end, start];

  const endExclusive = new Date(end);
  endExclusive.setDate(end.getDate() + 1);

  return {
    startKey: toDateKey(start),
    endKey: toDateKey(end),
    start,
    end,
    endExclusive,
    days: Math.round((endExclusive.getTime() - start.getTime()) / MS_PER_DAY),
  };
}

/** The equally-long window immediately before `range`, for period-on-period deltas. */
export function previousRange(range: DateRange): DateRange {
  const end = new Date(range.start);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (range.days - 1));

  const endExclusive = new Date(end);
  endExclusive.setDate(end.getDate() + 1);

  return {
    startKey: toDateKey(start),
    endKey: toDateKey(end),
    start,
    end,
    endExclusive,
    days: range.days,
  };
}

export type Granularity = "day" | "week" | "month";

export function parseGranularity(raw: RawSearchParams, key = "group"): Granularity {
  const value = first(raw[key]);
  return value === "week" || value === "month" ? value : "day";
}

/**
 * SQL expression producing a sortable bucket key for `column`.
 *
 * Composed with `Prisma.sql` and handed to `prisma.$queryRaw(query)` — never
 * interpolated into a `$queryRaw` tagged template, where a `Prisma.Sql` would
 * bind as a parameter and match nothing.
 */
function periodExpr(column: Prisma.Sql, granularity: Granularity): Prisma.Sql {
  if (granularity === "month") return Prisma.sql`DATE_FORMAT(${column}, '%Y-%m')`;
  // %x/%v is the ISO week-numbering year and week, so week 1 of January never
  // lands in the previous year's bucket.
  if (granularity === "week") return Prisma.sql`DATE_FORMAT(${column}, '%x-W%v')`;
  return Prisma.sql`DATE(${column})`;
}

/** Human label for a bucket key produced by `periodExpr`. */
export function periodLabel(key: string, granularity: Granularity): string {
  if (granularity === "week") {
    const [year, week] = key.split("-W");
    return `Week ${Number(week)}, ${year}`;
  }
  if (granularity === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  }
  const date = fromDateKey(key);
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : key;
}

/* =========================================================================
   CSV
   ========================================================================= */

/**
 * RFC 4180 field escaping: anything containing a comma, a double quote, CR or
 * LF is wrapped in quotes, and embedded quotes are doubled.
 */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export type CsvRow = (string | number | null | undefined)[];

export function toCsv(rows: CsvRow[]): string {
  // A leading BOM keeps Excel from mangling non-ASCII, as the legacy exporter did.
  return "﻿" + rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(rows: CsvRow[], filename: string): Response {
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/["\\]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Two-decimal number for a CSV cell — no thousands separators, no currency. */
export function csvMoney(value: number): string {
  return value.toFixed(2);
}

/* =========================================================================
   Accounting aggregates
   ========================================================================= */

export const ACCOUNT_TYPE_ORDER = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
  "COGS",
] as const;

export type AccountTypeKey = (typeof ACCOUNT_TYPE_ORDER)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountTypeKey, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
  COGS: "Cost of goods sold",
};

export type AccountSummaryRow = {
  type: AccountTypeKey;
  label: string;
  accounts: number;
  balance: number;
};

export async function getAccountSummary(
  storeId = DEFAULT_STORE_ID,
): Promise<AccountSummaryRow[]> {
  const grouped = await prisma.account.groupBy({
    by: ["type"],
    where: { storeId, isActive: true },
    _count: { _all: true },
    _sum: { currentBalance: true },
  });

  const byType = new Map(grouped.map((g) => [g.type, g]));

  return ACCOUNT_TYPE_ORDER.map((type) => {
    const hit = byType.get(type);
    return {
      type,
      label: ACCOUNT_TYPE_LABELS[type],
      accounts: hit?._count._all ?? 0,
      balance: toNumber(hit?._sum.currentBalance),
    };
  });
}

export type TrialBalanceRow = {
  id: number;
  code: string;
  name: string;
  type: AccountTypeKey;
  normalBalance: "DEBIT" | "CREDIT";
  debit: number;
  credit: number;
};

/**
 * Trial balance from the stored `currentBalance` column.
 *
 * A positive balance sits in the column matching the account's normal balance;
 * a negative one (an account that has been driven the "wrong" way) is shown in
 * the opposite column so the two totals still tie out. Legacy printed a single
 * signed figure, which never balanced.
 */
export async function getTrialBalance(storeId = DEFAULT_STORE_ID) {
  const accounts = await prisma.account.findMany({
    where: { storeId, isActive: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      normalBalance: true,
      currentBalance: true,
    },
  });

  const rows: TrialBalanceRow[] = accounts
    .map((a) => {
      const balance = toNumber(a.currentBalance);
      const onDebitSide = a.normalBalance === "DEBIT" ? balance >= 0 : balance < 0;
      const magnitude = Math.abs(balance);
      return {
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type as AccountTypeKey,
        normalBalance: a.normalBalance,
        debit: onDebitSide ? magnitude : 0,
        credit: onDebitSide ? 0 : magnitude,
      };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0);

  // Keep the report in the conventional statement order rather than A–Z.
  rows.sort(
    (a, b) =>
      ACCOUNT_TYPE_ORDER.indexOf(a.type) - ACCOUNT_TYPE_ORDER.indexOf(b.type) ||
      a.code.localeCompare(b.code),
  );

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);

  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
  };
}

/* =========================================================================
   Profit & loss
   ========================================================================= */

export type ProfitLoss = Awaited<ReturnType<typeof getProfitLoss>>;

export async function getProfitLoss(range: DateRange, storeId = DEFAULT_STORE_ID) {
  const orderWhere = {
    storeId,
    status: REVENUE_STATUSES,
    createdAt: { gte: range.start, lt: range.endExclusive },
  };

  const [orders, cogsRows, expenseGroups, categories] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _count: { _all: true },
      _sum: {
        totalAmount: true,
        subtotal: true,
        discountAmount: true,
        shippingAmount: true,
        taxAmount: true,
      },
    }),

    // Cost of goods sold uses the product's *current* cost price — order items
    // carry no cost snapshot, so restating a product's cost restates history.
    // Flagged rather than silently accepted; the schema would need a
    // `cost_price` column on `order_items` to fix it properly.
    prisma.$queryRaw<{ cogs: string | null; units: bigint | null }[]>(Prisma.sql`
      SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0) AS cogs,
             COALESCE(SUM(oi.quantity), 0) AS units
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.store_id = ${storeId}
        AND ${REVENUE_SQL}
        AND o.created_at >= ${range.start}
        AND o.created_at < ${range.endExclusive}
    `),

    prisma.expense.groupBy({
      by: ["categoryId"],
      where: {
        storeId,
        expenseDate: { gte: range.start, lte: range.end },
        paymentStatus: { not: "PENDING" },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),

    prisma.expenseCategory.findMany({
      where: { storeId },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const grossRevenue = toNumber(orders._sum.totalAmount);
  const taxCollected = toNumber(orders._sum.taxAmount);
  // Tax is collected on behalf of the state, so it is not revenue. Legacy
  // instead subtracted `discount_amount` again here, double-counting discounts
  // that `total_amount` had already netted off.
  const netRevenue = round2(grossRevenue - taxCollected);
  const cogs = round2(toNumber(cogsRows[0]?.cogs));

  const expenses = expenseGroups
    .map((g) => ({
      categoryId: g.categoryId,
      category: g.categoryId ? (categoryName.get(g.categoryId) ?? "Uncategorised") : "Uncategorised",
      count: g._count._all,
      amount: toNumber(g._sum.totalAmount),
    }))
    .filter((e) => e.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = round2(expenses.reduce((sum, e) => sum + e.amount, 0));
  const grossProfit = round2(netRevenue - cogs);
  const netProfit = round2(grossProfit - totalExpenses);

  return {
    range,
    orderCount: orders._count._all,
    grossRevenue,
    grossSales: toNumber(orders._sum.subtotal),
    discounts: toNumber(orders._sum.discountAmount),
    shipping: toNumber(orders._sum.shippingAmount),
    taxCollected,
    netRevenue,
    cogs,
    unitsSold: Number(cogsRows[0]?.units ?? 0),
    grossProfit,
    grossMargin: netRevenue > 0 ? round2((grossProfit / netRevenue) * 100) : 0,
    expenses,
    totalExpenses,
    netProfit,
    netMargin: netRevenue > 0 ? round2((netProfit / netRevenue) * 100) : 0,
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* =========================================================================
   Cash flow
   ========================================================================= */

export type CashFlowPeriod = {
  key: string;
  label: string;
  cashIn: number;
  expensesPaid: number;
  supplierPayments: number;
  refunds: number;
  cashOut: number;
  net: number;
  running: number;
};

export type CashFlow = Awaited<ReturnType<typeof getCashFlow>>;

/**
 * Cash basis: only orders whose payment has actually settled count as cash in,
 * and only paid expenses, supplier payments and completed refunds count as cash
 * out. That is why the totals here will not agree with the P&L, which is accrual.
 */
export async function getCashFlow(
  range: DateRange,
  granularity: Granularity = "day",
  storeId = DEFAULT_STORE_ID,
) {
  const orderPeriod = periodExpr(Prisma.sql`o.created_at`, granularity);
  const expensePeriod = periodExpr(Prisma.sql`e.expense_date`, granularity);
  const paymentPeriod = periodExpr(Prisma.sql`sp.payment_date`, granularity);
  const returnPeriod = periodExpr(Prisma.sql`r.created_at`, granularity);

  const [cashIn, expensesPaid, supplierPayments, refunds] = await Promise.all([
    prisma.$queryRaw<{ period: string; amount: string | null; entries: bigint }[]>(Prisma.sql`
      SELECT ${orderPeriod} AS period,
             COALESCE(SUM(o.total_amount), 0) AS amount,
             COUNT(*) AS entries
      FROM orders o
      WHERE o.store_id = ${storeId}
        AND ${REVENUE_SQL}
        AND o.payment_status = 'PAID'
        AND o.created_at >= ${range.start}
        AND o.created_at < ${range.endExclusive}
      GROUP BY period
    `),

    prisma.$queryRaw<{ period: string; amount: string | null }[]>(Prisma.sql`
      SELECT ${expensePeriod} AS period,
             COALESCE(SUM(e.total_amount), 0) AS amount
      FROM expenses e
      WHERE e.store_id = ${storeId}
        AND e.payment_status = 'PAID'
        AND e.expense_date >= ${range.start}
        AND e.expense_date <= ${range.end}
      GROUP BY period
    `),

    prisma.$queryRaw<{ period: string; amount: string | null }[]>(Prisma.sql`
      SELECT ${paymentPeriod} AS period,
             COALESCE(SUM(sp.amount), 0) AS amount
      FROM supplier_payments sp
      WHERE sp.store_id = ${storeId}
        AND sp.payment_date >= ${range.start}
        AND sp.payment_date <= ${range.end}
      GROUP BY period
    `),

    prisma.$queryRaw<{ period: string; amount: string | null }[]>(Prisma.sql`
      SELECT ${returnPeriod} AS period,
             COALESCE(SUM(r.refund_amount), 0) AS amount
      FROM returns r
      WHERE r.store_id = ${storeId}
        AND r.refund_status = 'COMPLETED'
        AND r.created_at >= ${range.start}
        AND r.created_at < ${range.endExclusive}
      GROUP BY period
    `),
  ]);

  const buckets = new Map<string, CashFlowPeriod>();
  const bucket = (key: string) => {
    let hit = buckets.get(key);
    if (!hit) {
      hit = {
        key,
        label: periodLabel(key, granularity),
        cashIn: 0,
        expensesPaid: 0,
        supplierPayments: 0,
        refunds: 0,
        cashOut: 0,
        net: 0,
        running: 0,
      };
      buckets.set(key, hit);
    }
    return hit;
  };

  for (const row of cashIn) bucket(String(row.period)).cashIn += toNumber(row.amount);
  for (const row of expensesPaid) {
    bucket(String(row.period)).expensesPaid += toNumber(row.amount);
  }
  for (const row of supplierPayments) {
    bucket(String(row.period)).supplierPayments += toNumber(row.amount);
  }
  for (const row of refunds) bucket(String(row.period)).refunds += toNumber(row.amount);

  const periods = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));

  let running = 0;
  for (const p of periods) {
    p.cashOut = round2(p.expensesPaid + p.supplierPayments + p.refunds);
    p.cashIn = round2(p.cashIn);
    p.net = round2(p.cashIn - p.cashOut);
    running = round2(running + p.net);
    p.running = running;
  }

  const totals = periods.reduce(
    (acc, p) => ({
      cashIn: acc.cashIn + p.cashIn,
      expensesPaid: acc.expensesPaid + p.expensesPaid,
      supplierPayments: acc.supplierPayments + p.supplierPayments,
      refunds: acc.refunds + p.refunds,
      cashOut: acc.cashOut + p.cashOut,
    }),
    { cashIn: 0, expensesPaid: 0, supplierPayments: 0, refunds: 0, cashOut: 0 },
  );

  return {
    range,
    granularity,
    periods,
    totals: {
      cashIn: round2(totals.cashIn),
      expensesPaid: round2(totals.expensesPaid),
      supplierPayments: round2(totals.supplierPayments),
      refunds: round2(totals.refunds),
      cashOut: round2(totals.cashOut),
      net: round2(totals.cashIn - totals.cashOut),
    },
  };
}

/* =========================================================================
   Expense report
   ========================================================================= */

export type ExpenseReport = Awaited<ReturnType<typeof getExpenseReport>>;

/**
 * Unlike the P&L, this includes expenses of every payment status — it is an
 * expense ledger, not a profit figure — and breaks them out by status so the
 * unpaid portion is visible rather than hidden.
 */
export async function getExpenseReport(range: DateRange, storeId = DEFAULT_STORE_ID) {
  const where = {
    storeId,
    expenseDate: { gte: range.start, lte: range.end },
  };

  const [byCategoryRaw, categories, monthly, byStatus, summary] = await Promise.all([
    prisma.expense.groupBy({
      by: ["categoryId"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),

    prisma.expenseCategory.findMany({
      where: { storeId },
      select: { id: true, name: true, color: true },
    }),

    prisma.$queryRaw<{ month: string; amount: string | null; entries: bigint }[]>(Prisma.sql`
      SELECT DATE_FORMAT(e.expense_date, '%Y-%m') AS month,
             COALESCE(SUM(e.total_amount), 0) AS amount,
             COUNT(*) AS entries
      FROM expenses e
      WHERE e.store_id = ${storeId}
        AND e.expense_date >= ${range.start}
        AND e.expense_date <= ${range.end}
      GROUP BY month
      ORDER BY month ASC
    `),

    prisma.expense.groupBy({
      by: ["paymentStatus"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),

    prisma.expense.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
      _max: { totalAmount: true },
      _min: { totalAmount: true },
    }),
  ]);

  const categoryMeta = new Map(categories.map((c) => [c.id, c]));
  const total = toNumber(summary._sum.totalAmount);

  const byCategory = byCategoryRaw
    .map((g) => {
      const meta = g.categoryId ? categoryMeta.get(g.categoryId) : undefined;
      const amount = toNumber(g._sum.totalAmount);
      return {
        categoryId: g.categoryId,
        category: meta?.name ?? "Uncategorised",
        color: meta?.color ?? "#6c757d",
        count: g._count._all,
        amount,
        share: total > 0 ? round2((amount / total) * 100) : 0,
      };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    range,
    total,
    count: summary._count._all,
    average: round2(toNumber(summary._avg.totalAmount)),
    highest: toNumber(summary._max.totalAmount),
    lowest: toNumber(summary._min.totalAmount),
    byCategory,
    byMonth: monthly.map((m) => ({
      month: String(m.month),
      label: periodLabel(String(m.month), "month"),
      amount: toNumber(m.amount),
      count: Number(m.entries),
      share: total > 0 ? round2((toNumber(m.amount) / total) * 100) : 0,
    })),
    byStatus: byStatus
      .map((s) => ({
        status: s.paymentStatus,
        count: s._count._all,
        amount: toNumber(s._sum.totalAmount),
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/* =========================================================================
   Sales reports
   ========================================================================= */

export type RevenuePoint = { date: string; revenue: number; orders: number };

/** Daily revenue across the range, zero-filled so the chart has no gaps. */
export async function getRevenueSeriesForRange(
  range: DateRange,
  storeId = DEFAULT_STORE_ID,
): Promise<RevenuePoint[]> {
  const rows = await prisma.$queryRaw<
    { day: string; revenue: string | null; orders: bigint }[]
  >(Prisma.sql`
    SELECT DATE(o.created_at) AS day,
           COALESCE(SUM(o.total_amount), 0) AS revenue,
           COUNT(*) AS orders
    FROM orders o
    WHERE o.store_id = ${storeId}
      AND ${REVENUE_SQL}
      AND o.created_at >= ${range.start}
      AND o.created_at < ${range.endExclusive}
    GROUP BY day
    ORDER BY day ASC
  `);

  const byDay = new Map(
    rows.map((r) => [
      String(r.day).slice(0, 10),
      { revenue: toNumber(r.revenue), orders: Number(r.orders) },
    ]),
  );

  // Capped so a multi-year range cannot render tens of thousands of SVG columns.
  const points: RevenuePoint[] = [];
  const limit = Math.min(range.days, 400);
  for (let i = 0; i < limit; i++) {
    const d = new Date(range.start);
    d.setDate(range.start.getDate() + i);
    const key = toDateKey(d);
    const hit = byDay.get(key);
    points.push({ date: key, revenue: hit?.revenue ?? 0, orders: hit?.orders ?? 0 });
  }
  return points;
}

export type SalesOverview = Awaited<ReturnType<typeof getSalesOverview>>;

export async function getSalesOverview(range: DateRange, storeId = DEFAULT_STORE_ID) {
  const previous = previousRange(range);

  const [current, prior, units, newCustomers, series] = await Promise.all([
    prisma.order.aggregate({
      where: {
        storeId,
        status: REVENUE_STATUSES,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: {
        storeId,
        status: REVENUE_STATUSES,
        createdAt: { gte: previous.start, lt: previous.endExclusive },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.orderItem.aggregate({
      where: {
        order: {
          storeId,
          status: REVENUE_STATUSES,
          createdAt: { gte: range.start, lt: range.endExclusive },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
    }),
    getRevenueSeriesForRange(range, storeId),
  ]);

  const revenue = toNumber(current._sum.totalAmount);
  const priorRevenue = toNumber(prior._sum.totalAmount);

  return {
    range,
    previous,
    revenue,
    orders: current._count._all,
    averageOrderValue: round2(toNumber(current._avg.totalAmount)),
    unitsSold: units._sum.quantity ?? 0,
    newCustomers,
    priorRevenue,
    priorOrders: prior._count._all,
    revenueChange:
      priorRevenue > 0 ? round2(((revenue - priorRevenue) / priorRevenue) * 100) : null,
    series,
  };
}

export type SalesReport = Awaited<ReturnType<typeof getSalesReport>>;

export async function getSalesReport(
  range: DateRange,
  granularity: Granularity = "day",
  storeId = DEFAULT_STORE_ID,
) {
  const period = periodExpr(Prisma.sql`o.created_at`, granularity);

  const [rows, summary, statuses, methods] = await Promise.all([
    prisma.$queryRaw<
      {
        period: string;
        orders: bigint;
        revenue: string | null;
        subtotal: string | null;
        discounts: string | null;
        shipping: string | null;
        tax: string | null;
      }[]
    >(Prisma.sql`
      SELECT ${period} AS period,
             COUNT(*) AS orders,
             COALESCE(SUM(o.total_amount), 0) AS revenue,
             COALESCE(SUM(o.subtotal), 0) AS subtotal,
             COALESCE(SUM(o.discount_amount), 0) AS discounts,
             COALESCE(SUM(o.shipping_amount), 0) AS shipping,
             COALESCE(SUM(o.tax_amount), 0) AS tax
      FROM orders o
      WHERE o.store_id = ${storeId}
        AND ${REVENUE_SQL}
        AND o.created_at >= ${range.start}
        AND o.created_at < ${range.endExclusive}
      GROUP BY period
      ORDER BY period ASC
    `),

    prisma.order.aggregate({
      where: {
        storeId,
        status: REVENUE_STATUSES,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
      _count: { _all: true },
      _sum: {
        totalAmount: true,
        subtotal: true,
        discountAmount: true,
        shippingAmount: true,
        taxAmount: true,
      },
      _avg: { totalAmount: true },
      _max: { totalAmount: true },
      _min: { totalAmount: true },
    }),

    // Deliberately unfiltered by status — the whole point of the breakdown is to
    // show how much revenue cancellations and refunds took out.
    prisma.order.groupBy({
      by: ["status"],
      where: { storeId, createdAt: { gte: range.start, lt: range.endExclusive } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),

    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: {
        storeId,
        status: REVENUE_STATUSES,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const periods = rows.map((r) => ({
    key: String(r.period),
    label: periodLabel(String(r.period), granularity),
    orders: Number(r.orders),
    revenue: toNumber(r.revenue),
    subtotal: toNumber(r.subtotal),
    discounts: toNumber(r.discounts),
    shipping: toNumber(r.shipping),
    tax: toNumber(r.tax),
  }));

  const orderCount = summary._count._all;
  const revenue = toNumber(summary._sum.totalAmount);

  return {
    range,
    granularity,
    periods,
    totals: {
      orders: orderCount,
      revenue,
      subtotal: toNumber(summary._sum.subtotal),
      discounts: toNumber(summary._sum.discountAmount),
      shipping: toNumber(summary._sum.shippingAmount),
      tax: toNumber(summary._sum.taxAmount),
      averageOrderValue: round2(toNumber(summary._avg.totalAmount)),
      largestOrder: toNumber(summary._max.totalAmount),
      smallestOrder: toNumber(summary._min.totalAmount),
      averagePerDay: range.days > 0 ? round2(revenue / range.days) : 0,
      ordersPerDay: range.days > 0 ? round2(orderCount / range.days) : 0,
    },
    byStatus: statuses
      .map((s) => ({
        status: s.status,
        orders: s._count._all,
        revenue: toNumber(s._sum.totalAmount),
      }))
      .sort((a, b) => b.orders - a.orders),
    byPaymentMethod: methods
      .map((m) => ({
        method: m.paymentMethod ?? "Unknown",
        orders: m._count._all,
        revenue: toNumber(m._sum.totalAmount),
      }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export type ProductReportRow = {
  id: number;
  name: string;
  sku: string | null;
  units: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number | null;
  stock: number;
  hasCost: boolean;
};

export type ProductReport = Awaited<ReturnType<typeof getProductReport>>;

export async function getProductReport(range: DateRange, storeId = DEFAULT_STORE_ID) {
  const rows = await prisma.$queryRaw<
    {
      id: number;
      name: string;
      sku: string | null;
      cost_price: string | null;
      stock_quantity: number;
      units: string | null;
      revenue: string | null;
      cost: string | null;
    }[]
  >(Prisma.sql`
    SELECT p.id,
           p.name,
           p.sku,
           p.cost_price,
           p.stock_quantity,
           COALESCE(SUM(oi.quantity), 0) AS units,
           COALESCE(SUM(oi.total_price), 0) AS revenue,
           COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0) AS cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.store_id = ${storeId}
      AND ${REVENUE_SQL}
      AND o.created_at >= ${range.start}
      AND o.created_at < ${range.endExclusive}
    GROUP BY p.id, p.name, p.sku, p.cost_price, p.stock_quantity
    ORDER BY units DESC, revenue DESC
  `);

  const products: ProductReportRow[] = rows.map((r) => {
    const revenue = toNumber(r.revenue);
    const hasCost = r.cost_price !== null && toNumber(r.cost_price) > 0;
    const cost = hasCost ? toNumber(r.cost) : 0;
    const margin = hasCost ? round2(revenue - cost) : 0;
    return {
      id: r.id,
      name: r.name,
      sku: r.sku,
      units: Number(r.units),
      revenue,
      cost,
      margin,
      marginPercent: hasCost && revenue > 0 ? round2((margin / revenue) * 100) : null,
      stock: Number(r.stock_quantity),
      hasCost,
    };
  });

  const totals = products.reduce(
    (acc, p) => ({
      units: acc.units + p.units,
      revenue: acc.revenue + p.revenue,
      cost: acc.cost + p.cost,
    }),
    { units: 0, revenue: 0, cost: 0 },
  );

  // Worst sellers are the slowest *movers* among products that did sell; a
  // product with no sales at all simply is not in the join.
  const worst = [...products].sort((a, b) => a.units - b.units || a.revenue - b.revenue);

  return {
    range,
    products,
    best: products.slice(0, 10),
    worst: worst.slice(0, 10),
    totals: {
      units: totals.units,
      revenue: round2(totals.revenue),
      cost: round2(totals.cost),
      margin: round2(totals.revenue - totals.cost),
      distinctProducts: products.length,
    },
  };
}

export type CustomerReport = Awaited<ReturnType<typeof getCustomerReport>>;

export async function getCustomerReport(range: DateRange, storeId = DEFAULT_STORE_ID) {
  const [top, split, inRange, guestOrders] = await Promise.all([
    // Lifetime spend — deliberately not date-filtered.
    prisma.$queryRaw<
      {
        id: number;
        name: string;
        email: string;
        orders: bigint;
        spent: string | null;
        last_order: Date | null;
      }[]
    >(Prisma.sql`
      SELECT u.id,
             u.name,
             u.email,
             COUNT(o.id) AS orders,
             COALESCE(SUM(o.total_amount), 0) AS spent,
             MAX(o.created_at) AS last_order
      FROM users u
      JOIN orders o ON o.user_id = u.id
      WHERE o.store_id = ${storeId}
        AND ${REVENUE_SQL}
      GROUP BY u.id, u.name, u.email
      ORDER BY spent DESC
      LIMIT 20
    `),

    // New = the customer's first-ever order falls inside the range.
    prisma.$queryRaw<{ new_customers: bigint; returning_customers: bigint }[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE WHEN t.first_order >= ${range.start} THEN 1 ELSE 0 END), 0)
          AS new_customers,
        COALESCE(SUM(CASE WHEN t.first_order < ${range.start} THEN 1 ELSE 0 END), 0)
          AS returning_customers
      FROM (
        SELECT o.user_id,
               MIN(all_o.created_at) AS first_order
        FROM orders o
        JOIN orders all_o
          ON all_o.user_id = o.user_id
         AND all_o.store_id = ${storeId}
         AND all_o.status NOT IN ('CANCELLED', 'REFUNDED')
        WHERE o.store_id = ${storeId}
          AND o.user_id IS NOT NULL
          AND ${REVENUE_SQL}
          AND o.created_at >= ${range.start}
          AND o.created_at < ${range.endExclusive}
        GROUP BY o.user_id
      ) t
    `),

    prisma.order.aggregate({
      where: {
        storeId,
        status: REVENUE_STATUSES,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    }),

    prisma.order.count({
      where: {
        storeId,
        userId: null,
        status: REVENUE_STATUSES,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
    }),
  ]);

  const newCustomers = Number(split[0]?.new_customers ?? 0);
  const returningCustomers = Number(split[0]?.returning_customers ?? 0);

  return {
    range,
    topCustomers: top.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      orders: Number(c.orders),
      spent: toNumber(c.spent),
      lastOrder: c.last_order,
      averageOrder: Number(c.orders) > 0 ? round2(toNumber(c.spent) / Number(c.orders)) : 0,
    })),
    newCustomers,
    returningCustomers,
    activeCustomers: newCustomers + returningCustomers,
    guestOrders,
    orders: inRange._count._all,
    revenue: toNumber(inRange._sum.totalAmount),
    averageOrderValue: round2(toNumber(inRange._avg.totalAmount)),
  };
}
