import { CURRENCY } from "./config";

/** Anything Prisma might hand us for a DECIMAL column. */
export type Money = number | string | { toString(): string } | null | undefined;

/**
 * Prisma returns `Decimal` objects for DECIMAL columns, which cannot cross the
 * server/client boundary. Normalise to a plain number at the data-access edge.
 */
export function toNumber(value: Money): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** `formatPrice(1299)` → `"BDT 1,299.00"` — matches the legacy helper exactly. */
export function formatPrice(value: Money): string {
  const n = toNumber(value);
  return `${CURRENCY.symbol} ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Effective selling price: sale price when it is a real discount, else the
 * regular price.
 *
 * The legacy code used `sale_price ?? price` / `COALESCE(sale_price, price)`,
 * which treats a stored `0.00` as a valid free sale price. We require the sale
 * price to be strictly positive and below the regular price.
 */
export function effectivePrice(price: Money, salePrice: Money): number {
  const base = toNumber(price);
  const sale = toNumber(salePrice);
  return sale > 0 && sale < base ? sale : base;
}

export function isOnSale(price: Money, salePrice: Money): boolean {
  const base = toNumber(price);
  const sale = toNumber(salePrice);
  return sale > 0 && sale < base;
}

/** Whole-percent discount, e.g. 2000 → 1500 is 25. */
export function discountPercent(price: Money, salePrice: Money): number {
  const base = toNumber(price);
  const sale = toNumber(salePrice);
  if (base <= 0 || sale <= 0 || sale >= base) return 0;
  return Math.round(((base - sale) / base) * 100);
}
