"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { resolveImageInput } from "@/lib/admin/upload";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { generateExpenseNumber, withUniqueDocNumber } from "@/lib/doc-number";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { fieldErrors, type FormState } from "@/actions/types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

const expenseSchema = z.object({
  title: z.string().trim().min(2, "Enter a title").max(255),
  categoryId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "" || v === null) return null;
      const n = Number(v);
      return Number.isInteger(n) ? n : null;
    }),
  description: z.string().trim().optional(),
  // Legacy validated with `empty()`, which rejected a zero amount as "required"
  // while happily accepting a negative one. Zero is allowed here; below zero is
  // a credit note, which this screen does not model.
  amount: z.coerce
    .number()
    .min(0, "Amount cannot be negative")
    .max(99_999_999, "That amount is too large"),
  taxAmount: z.coerce
    .number()
    .min(0, "Tax cannot be negative")
    .max(99_999_999, "That tax amount is too large")
    .default(0),
  expenseDate: z.string().trim().min(1, "Choose a date"),
  paymentMethod: z
    .enum(["CASH", "BANK_TRANSFER", "MOBILE_BANKING", "CARD", "OTHER"])
    .default("CASH"),
  paymentStatus: z.enum(["PENDING", "PAID", "PARTIAL"]).default("PENDING"),
  referenceNumber: z.string().trim().max(100).optional(),
  vendorName: z.string().trim().max(255).optional(),
  notes: z.string().trim().optional(),
});

/** Category must exist in this store, else the reference is dropped. */
async function resolveCategoryId(categoryId: number | null): Promise<number | null> {
  if (categoryId === null) return null;
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  return category?.id ?? null;
}

export async function createExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const expenseDate = parseDateOnly(d.expenseDate);
  if (!expenseDate) return { ok: false, errors: { expenseDate: ["Enter a valid date"] } };

  const receipt = await resolveImageInput(
    formData.get("receiptFile") as File | null,
    formData.get("receiptUrl") as string | null,
    "receipts",
  );
  if (receipt && !receipt.ok) {
    return { ok: false, errors: { receiptUrl: [receipt.error] } };
  }

  const amount = round2(d.amount);
  const taxAmount = round2(d.taxAmount);
  const categoryId = await resolveCategoryId(d.categoryId);

  const expense = await withUniqueDocNumber(generateExpenseNumber, (expenseNumber) =>
    prisma.expense.create({
      data: {
        storeId: DEFAULT_STORE_ID,
        categoryId,
        expenseNumber,
        title: d.title,
        description: d.description || null,
        amount,
        taxAmount,
        // Always derived — never read a client-sent total.
        totalAmount: round2(amount + taxAmount),
        expenseDate,
        paymentMethod: d.paymentMethod,
        paymentStatus: d.paymentStatus,
        referenceNumber: d.referenceNumber || null,
        vendorName: d.vendorName || null,
        receiptPath: receipt?.ok ? receipt.path : null,
        notes: d.notes || null,
        createdById: user.id,
      },
      select: { id: true },
    }),
  );

  revalidatePath("/admin/expenses");
  redirect(`/admin/expenses/${expense.id}?created=1`);
}

export async function updateExpense(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.expense.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, receiptPath: true },
  });
  if (!existing) return { ok: false, message: "That expense no longer exists." };

  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const expenseDate = parseDateOnly(d.expenseDate);
  if (!expenseDate) return { ok: false, errors: { expenseDate: ["Enter a valid date"] } };

  // Upload first, then swap the pointer. Legacy unlinked the old receipt before
  // attempting the new upload, so a failed upload lost the original outright.
  const receipt = await resolveImageInput(
    formData.get("receiptFile") as File | null,
    formData.get("receiptUrl") as string | null,
    "receipts",
  );
  if (receipt && !receipt.ok) {
    return { ok: false, errors: { receiptUrl: [receipt.error] } };
  }

  const clearReceipt = parseCheckbox(formData, "removeReceipt");
  const receiptPath = receipt?.ok
    ? receipt.path
    : clearReceipt
      ? null
      : existing.receiptPath;

  const amount = round2(d.amount);
  const taxAmount = round2(d.taxAmount);

  await prisma.expense.update({
    where: { id },
    data: {
      categoryId: await resolveCategoryId(d.categoryId),
      title: d.title,
      description: d.description || null,
      amount,
      taxAmount,
      totalAmount: round2(amount + taxAmount),
      expenseDate,
      paymentMethod: d.paymentMethod,
      paymentStatus: d.paymentStatus,
      referenceNumber: d.referenceNumber || null,
      vendorName: d.vendorName || null,
      receiptPath,
      notes: d.notes || null,
    },
  });

  revalidatePath("/admin/expenses");
  revalidatePath(`/admin/expenses/${id}`);
  return { ok: true, message: "Expense saved." };
}

export async function deleteExpense(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.expense.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That expense no longer exists." };

  await prisma.expense.delete({ where: { id } });

  revalidatePath("/admin/expenses");
  return { ok: true, message: "Expense deleted." };
}

/* -------------------------------------------------------------------------
   Categories
   ------------------------------------------------------------------------- */

const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(100),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour such as #6c757d")
    .default("#6c757d"),
  icon: z.string().trim().max(50).default("tag"),
});

/** Unique within the store, suffixing -2, -3, … as `uniqueSlug` does for products. */
async function uniqueCategorySlug(base: string, excludeId?: number): Promise<string> {
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const clash = await prisma.expenseCategory.findFirst({
      where: {
        storeId: DEFAULT_STORE_ID,
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createExpenseCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  await prisma.expenseCategory.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      slug: await uniqueCategorySlug(slugify(d.slug || d.name)),
      description: d.description || null,
      color: d.color,
      icon: d.icon || "tag",
      isActive: parseCheckbox(formData, "isActive"),
    },
  });

  revalidatePath("/admin/expenses/categories");
  revalidatePath("/admin/expenses");
  return { ok: true, message: "Category added." };
}

export async function updateExpenseCategory(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.expenseCategory.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, slug: true },
  });
  if (!existing) return { ok: false, message: "That category no longer exists." };

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const desired = slugify(d.slug || d.name);
  const slug =
    desired === existing.slug ? existing.slug : await uniqueCategorySlug(desired, id);

  await prisma.expenseCategory.update({
    where: { id },
    data: {
      name: d.name,
      slug,
      description: d.description || null,
      color: d.color,
      icon: d.icon || "tag",
      isActive: parseCheckbox(formData, "isActive"),
    },
  });

  revalidatePath("/admin/expenses/categories");
  revalidatePath("/admin/expenses");
  return { ok: true, message: "Category saved." };
}

export async function deleteExpenseCategory(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.expenseCategory.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That category no longer exists." };

  // Legacy refused to delete a category that had expenses. The FK is SetNull,
  // so instead the expenses are uncategorised and kept — losing a label is a
  // far smaller problem than being unable to tidy the category list.
  const used = await prisma.expense.count({ where: { categoryId: id } });

  await prisma.$transaction(async (tx) => {
    if (used > 0) {
      await tx.expense.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });
    }
    await tx.expenseCategory.delete({ where: { id } });
  });

  revalidatePath("/admin/expenses/categories");
  revalidatePath("/admin/expenses");

  return {
    ok: true,
    message:
      used > 0
        ? `Category deleted. ${used} expense${used === 1 ? " was" : "s were"} moved to uncategorised.`
        : "Category deleted.",
  };
}
