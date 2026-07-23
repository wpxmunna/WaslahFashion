"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { compareVariants } from "@/lib/variants";
import type { FormState } from "@/actions/types";

const schema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable(),
  newQuantity: z.number().int().min(0, "Quantity cannot be negative").max(1_000_000),
  reason: z.string().trim().min(1, "Choose a reason").max(50),
  note: z.string().trim().max(500).optional(),
});

export type AdjustStockInput = z.infer<typeof schema>;

export async function adjustStock(input: AdjustStockInput): Promise<FormState> {
  const staff = await requireStaff();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }
  const d = parsed.data;

  const product = await prisma.product.findFirst({
    where: { id: d.productId, storeId: DEFAULT_STORE_ID },
    select: { id: true, name: true, stockQuantity: true },
  });
  if (!product) return { ok: false, message: "Product not found." };

  let current: number;
  let variantInfo: string | null = null;
  if (d.variantId) {
    const v = await prisma.productVariant.findFirst({
      where: { id: d.variantId, productId: d.productId },
      select: { stockQuantity: true, size: true, colorName: true, color: { select: { name: true } } },
    });
    if (!v) return { ok: false, message: "Variant not found." };
    current = v.stockQuantity;
    variantInfo = [v.size, v.colorName ?? v.color?.name].filter(Boolean).join(" / ") || null;
  } else {
    current = product.stockQuantity;
  }

  const delta = d.newQuantity - current;
  if (delta === 0) {
    return { ok: false, message: "The new quantity matches the current stock." };
  }

  await prisma.$transaction(async (tx) => {
    if (d.variantId) {
      await tx.productVariant.update({ where: { id: d.variantId }, data: { stockQuantity: d.newQuantity } });
    } else {
      await tx.product.update({ where: { id: d.productId }, data: { stockQuantity: d.newQuantity } });
    }
    await tx.stockAdjustment.create({
      data: {
        storeId: DEFAULT_STORE_ID,
        productId: d.productId,
        variantId: d.variantId,
        productName: product.name,
        variantInfo,
        delta,
        newQuantity: d.newQuantity,
        reason: d.reason,
        note: d.note || null,
        staffName: staff.name,
      },
    });
  });

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${d.productId}`);
  return { ok: true, message: `Stock adjusted (${delta > 0 ? "+" : ""}${delta}).` };
}

export type StockTarget = {
  productId: number;
  productName: string;
  baseStock: number;
  variants: { id: number; label: string; stock: number }[];
};

/** Current stock for a product and its active variants, for the adjust form. */
export async function getStockTarget(productId: number): Promise<StockTarget | null> {
  await requireStaff();
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      name: true,
      stockQuantity: true,
      variants: {
        where: { isActive: true },
        select: { id: true, size: true, colorName: true, color: { select: { name: true } }, stockQuantity: true },
      },
    },
  });
  if (!product) return null;

  const variants = product.variants
    .map((v) => ({ id: v.id, size: v.size, colorName: v.colorName ?? v.color?.name ?? null, stock: v.stockQuantity }))
    .sort(compareVariants)
    .map((v) => ({ id: v.id, label: [v.size, v.colorName].filter(Boolean).join(" / ") || "Variant", stock: v.stock }));

  return { productId: product.id, productName: product.name, baseStock: product.stockQuantity, variants };
}
