import "server-only";

import { Prisma } from "@/generated/prisma";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";

/** Revenue deliberately excludes cancelled and refunded orders, as in legacy. */
const REVENUE_STATUSES = {
  notIn: ["CANCELLED", "REFUNDED"],
} satisfies Prisma.EnumOrderStatusFilter;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getDashboardStats(storeId = DEFAULT_STORE_ID) {
  const today = startOfToday();
  const monthStart = startOfMonth();

  const [
    orderTotals,
    todayTotals,
    monthTotals,
    pendingCount,
    customerCount,
    productCount,
    lowStock,
    recentOrders,
    topProducts,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { storeId, status: REVENUE_STATUSES },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { storeId, status: REVENUE_STATUSES, createdAt: { gte: today } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { storeId, status: REVENUE_STATUSES, createdAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { storeId, status: "PENDING" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count({ where: { storeId, status: "ACTIVE" } }),
    prisma.$queryRaw<{ id: number; name: string; slug: string; stock_quantity: number }[]>`
      SELECT id, name, slug, stock_quantity
      FROM products
      WHERE store_id = ${storeId}
        AND status = 'ACTIVE'
        AND stock_quantity <= low_stock_threshold
      ORDER BY stock_quantity ASC
      LIMIT 8
    `,
    prisma.order.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true,
        shippingName: true,
        user: { select: { name: true } },
      },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { productId: { not: null }, order: { storeId, status: REVENUE_STATUSES } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  return {
    orders: {
      total: orderTotals._count._all,
      today: todayTotals._count._all,
      month: monthTotals._count._all,
      pending: pendingCount,
    },
    revenue: {
      total: toNumber(orderTotals._sum.totalAmount),
      today: toNumber(todayTotals._sum.totalAmount),
      month: toNumber(monthTotals._sum.totalAmount),
    },
    customerCount,
    productCount,
    lowStock,
    recentOrders,
    topProducts: topProducts.map((p) => ({
      productId: p.productId,
      name: p.productName,
      units: p._sum.quantity ?? 0,
      revenue: toNumber(p._sum.totalPrice),
    })),
  };
}

/** Daily revenue for the last N days, zero-filled for days with no orders. */
export async function getRevenueSeries(days = 14, storeId = DEFAULT_STORE_ID) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = await prisma.$queryRaw<{ day: string; revenue: string; orders: bigint }[]>`
    SELECT DATE(created_at) AS day,
           COALESCE(SUM(total_amount), 0) AS revenue,
           COUNT(*) AS orders
    FROM orders
    WHERE store_id = ${storeId}
      AND status NOT IN ('CANCELLED', 'REFUNDED')
      AND created_at >= ${since}
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `;

  const byDay = new Map(
    rows.map((r) => [
      String(r.day).slice(0, 10),
      { revenue: Number(r.revenue), orders: Number(r.orders) },
    ]),
  );

  const series: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    series.push({ date: key, revenue: hit?.revenue ?? 0, orders: hit?.orders ?? 0 });
  }

  return series;
}
