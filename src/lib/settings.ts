import "server-only";

import { cache } from "react";

import {
  DEFAULT_SHIPPING_COST,
  DEFAULT_STORE_ID,
  FREE_SHIPPING_THRESHOLD,
  TAX_RATE,
} from "./config";
import { prisma } from "./prisma";

export type ShippingSettings = {
  freeShippingThreshold: number;
  defaultShippingCost: number;
  taxRate: number;
};

function positive(value: string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Shipping rules, editable from Admin → Settings.
 *
 * The constants in `lib/config.ts` remain the fallback, so the storefront still
 * works before anything is configured and if the settings row is malformed.
 * Deduped per request via `cache`, so a page that computes cart totals several
 * times only hits the database once.
 */
export const getShippingSettings = cache(async (): Promise<ShippingSettings> => {
  try {
    const rows = await prisma.setting.findMany({
      where: {
        storeId: DEFAULT_STORE_ID,
        key: { in: ["free_shipping_threshold", "default_shipping_cost", "tax_rate"] },
      },
      select: { key: true, value: true },
    });

    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      freeShippingThreshold: positive(
        map.get("free_shipping_threshold"),
        FREE_SHIPPING_THRESHOLD,
      ),
      defaultShippingCost: positive(map.get("default_shipping_cost"), DEFAULT_SHIPPING_COST),
      taxRate: positive(map.get("tax_rate"), TAX_RATE),
    };
  } catch {
    // Never let a settings lookup take down the cart.
    return {
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      defaultShippingCost: DEFAULT_SHIPPING_COST,
      taxRate: TAX_RATE,
    };
  }
});

/** Business/contact details for the header, footer, invoices and receipts. */
export const getBusinessSettings = cache(async (): Promise<Record<string, string>> => {
  try {
    const rows = await prisma.setting.findMany({
      where: { storeId: DEFAULT_STORE_ID },
      select: { key: true, value: true },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
  } catch {
    return {};
  }
});
