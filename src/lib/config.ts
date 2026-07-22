/**
 * Site-wide constants, ported from the legacy `config/config.php`.
 *
 * Currency note: the legacy app went through a painful migration from the `৳`
 * glyph (which double-encoded to mojibake) to the literal string "BDT". The
 * stale `config.production.php` still carries `£`/GBP and the old README says
 * `$`/USD — both are wrong. BDT is authoritative and is deliberately defined
 * here in code rather than read from the database.
 */
export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? "Waslah",
  tagline: "Authenticity in Every Stitch",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "info@waslah.com",
} as const;

export const CURRENCY = {
  code: "BDT",
  symbol: "BDT",
} as const;

/** Orders at or above this subtotal ship free. */
export const FREE_SHIPPING_THRESHOLD = 5000;

/** Flat shipping fee below the free-shipping threshold. */
export const DEFAULT_SHIPPING_COST = 80;

/** Legacy TAX_RATE was 0.00 — tax is plumbed through but currently disabled. */
export const TAX_RATE = 0;

export const PRODUCTS_PER_PAGE = 12;
export const ORDERS_PER_PAGE = 20;

/** Legacy defaulted addresses to "United States" on a Bangladesh store. */
export const DEFAULT_COUNTRY = "Bangladesh";

export const DEFAULT_STORE_ID = 1;

/** Scrolling marquee under the hero. Editable at Admin → Settings → Homepage. */
export const DEFAULT_MARQUEE = [
  "New season drop",
  "Authenticity in every stitch",
  "Handloom & block print",
  "Free delivery over BDT 5,000",
  "Sourced directly from makers",
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
  { value: "name_asc", label: "Name: A–Z" },
  { value: "name_desc", label: "Name: Z–A" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export function isSortValue(v: string | undefined): v is SortValue {
  return !!v && SORT_OPTIONS.some((o) => o.value === v);
}
