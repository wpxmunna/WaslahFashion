"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

const COUPON_TYPES = [
  "FIXED",
  "PERCENTAGE",
  "FREE_SHIPPING",
  "GIFT_ITEM",
  "BUY_X_GET_Y",
] as const;

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  });

/**
 * `datetime-local` posts `2026-07-21T09:30` with no zone, which `new Date()`
 * reads as local time — the behaviour an admin expects from the picker.
 */
const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    const trimmed = v?.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Codes need at least 3 characters")
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens and underscores only")
    .transform((v) => v.toUpperCase()),
  type: z.enum(COUPON_TYPES).default("FIXED"),
  value: optionalNumber,
  minimumAmount: z.coerce.number().min(0, "Minimum spend cannot be negative").default(0),
  maximumDiscount: optionalNumber,
  giftProductId: optionalInt,
  buyQuantity: optionalInt,
  getQuantity: optionalInt,
  usageLimit: optionalInt,
  startsAt: optionalDate,
  expiresAt: optionalDate,
  isActive: z.coerce.boolean().default(true),
});

type CouponInput = z.infer<typeof couponSchema>;

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readCoupon(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return couponSchema.safeParse({
    ...raw,
    isActive: parseCheckbox(formData, "isActive"),
  });
}

/**
 * Type-specific rules, plus the shared date-window check.
 *
 * Returns field errors so the form can highlight the offending input rather
 * than the legacy behaviour of bouncing back with a single flash message.
 */
async function validateCoupon(d: CouponInput): Promise<Record<string, string[]> | null> {
  const errors: Record<string, string[]> = {};

  switch (d.type) {
    case "FIXED":
      if (d.value === null || d.value <= 0) {
        errors.value = ["Enter a discount amount above 0"];
      }
      break;

    case "PERCENTAGE":
      if (d.value === null || d.value < 1 || d.value > 100) {
        errors.value = ["A percentage must be between 1 and 100"];
      }
      if (d.maximumDiscount !== null && d.maximumDiscount <= 0) {
        errors.maximumDiscount = ["Leave blank for no cap, or enter an amount above 0"];
      }
      break;

    case "GIFT_ITEM": {
      if (d.giftProductId === null) {
        errors.giftProductId = ["Choose the product to give away"];
        break;
      }
      const gift = await prisma.product.findFirst({
        where: { id: d.giftProductId, storeId: DEFAULT_STORE_ID },
        select: { id: true },
      });
      if (!gift) errors.giftProductId = ["That product doesn't exist"];
      break;
    }

    case "BUY_X_GET_Y":
      if (d.buyQuantity === null || d.buyQuantity < 1) {
        errors.buyQuantity = ["Buy quantity must be at least 1"];
      }
      if (d.getQuantity === null || d.getQuantity < 1) {
        errors.getQuantity = ["Free quantity must be at least 1"];
      }
      break;

    case "FREE_SHIPPING":
      // Nothing extra — the discount is the order's shipping cost.
      break;
  }

  if (d.usageLimit !== null && d.usageLimit < 1) {
    errors.usageLimit = ["Leave blank for unlimited, or enter 1 or more"];
  }

  if (d.startsAt && d.expiresAt && d.expiresAt <= d.startsAt) {
    errors.expiresAt = ["The end date must be after the start date"];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Blank out the columns that do not apply to the chosen type.
 *
 * `calculateDiscount()` in `src/lib/coupons.ts` reads `value`, `maximumDiscount`
 * and `buyQuantity`/`getQuantity` straight off the row, so a stale value left
 * behind by a type change would quietly alter the discount.
 */
function normalise(d: CouponInput) {
  const isValueType = d.type === "FIXED" || d.type === "PERCENTAGE";

  return {
    code: d.code,
    type: d.type,
    value: isValueType ? (d.value ?? 0) : 0,
    minimumAmount: d.minimumAmount,
    maximumDiscount: d.type === "PERCENTAGE" ? d.maximumDiscount : null,
    giftProductId: d.type === "GIFT_ITEM" ? d.giftProductId : null,
    buyQuantity: d.type === "BUY_X_GET_Y" ? d.buyQuantity : null,
    getQuantity: d.type === "BUY_X_GET_Y" ? d.getQuantity : null,
    usageLimit: d.usageLimit,
    startsAt: d.startsAt,
    expiresAt: d.expiresAt,
    isActive: d.isActive,
  };
}

async function codeTaken(code: string, excludeId?: number): Promise<boolean> {
  const clash = await prisma.coupon.findFirst({
    where: {
      storeId: DEFAULT_STORE_ID,
      code,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  return clash !== null;
}

export async function createCoupon(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readCoupon(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const errors = await validateCoupon(d);
  if (errors) return { ok: false, errors, message: "Please check the highlighted fields." };

  if (await codeTaken(d.code)) {
    return { ok: false, errors: { code: ["That code is already in use"] } };
  }

  const coupon = await prisma.coupon.create({
    data: { storeId: DEFAULT_STORE_ID, ...normalise(d) },
    select: { id: true },
  });

  revalidatePath("/admin/coupons");
  redirect(`/admin/coupons/${coupon.id}?created=1`);
}

export async function updateCoupon(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readCoupon(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const existing = await prisma.coupon.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That coupon no longer exists." };

  const errors = await validateCoupon(d);
  if (errors) return { ok: false, errors, message: "Please check the highlighted fields." };

  if (await codeTaken(d.code, id)) {
    return { ok: false, errors: { code: ["That code is already in use"] } };
  }

  // `usedCount` is deliberately untouched — it belongs to order history.
  await prisma.coupon.update({ where: { id }, data: normalise(d) });

  revalidatePath("/admin/coupons");
  revalidatePath(`/admin/coupons/${id}`);
  return { ok: true, message: "Coupon saved." };
}

export async function toggleCoupon(id: number): Promise<FormState> {
  await requireStaff();

  const coupon = await prisma.coupon.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isActive: true },
  });
  if (!coupon) return { ok: false, message: "That coupon no longer exists." };

  await prisma.coupon.update({ where: { id }, data: { isActive: !coupon.isActive } });

  revalidatePath("/admin/coupons");
  revalidatePath(`/admin/coupons/${id}`);
  return {
    ok: true,
    message: coupon.isActive ? "Coupon deactivated." : "Coupon activated.",
  };
}

export async function deleteCoupon(id: number): Promise<FormState> {
  await requireStaff();

  const coupon = await prisma.coupon.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      code: true,
      usedCount: true,
      _count: { select: { orders: true } },
    },
  });
  if (!coupon) return { ok: false, message: "That coupon no longer exists." };

  // A coupon on an order is part of that order's price breakdown; deleting it
  // would null the FK and lose the record of why the total was discounted.
  if (coupon.usedCount > 0 || coupon._count.orders > 0) {
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });

    revalidatePath("/admin/coupons");
    revalidatePath(`/admin/coupons/${id}`);
    return {
      ok: true,
      message: `${coupon.code} has been used on past orders, so it was deactivated rather than deleted.`,
    };
  }

  await prisma.coupon.delete({ where: { id } });

  revalidatePath("/admin/coupons");
  return { ok: true, message: "Coupon deleted." };
}
