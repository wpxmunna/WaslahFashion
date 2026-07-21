"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fieldErrors, type FormState } from "@/actions/types";
import { Prisma } from "@/generated/prisma";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { generateReturnNumber } from "@/lib/return-number";

const RETURN_REASONS = [
  "DEFECTIVE",
  "DAMAGED",
  "WRONG_ITEM",
  "NOT_AS_DESCRIBED",
  "CHANGED_MIND",
  "CUSTOMER_REFUSED",
  "UNDELIVERED",
  "OTHER",
] as const;

const REFUND_STATUSES = ["NOT_REQUIRED", "PENDING", "COMPLETED"] as const;

const returnSchema = z.object({
  orderId: z.coerce.number().int().positive("Choose an order"),
  reason: z.enum(RETURN_REASONS),
  reasonDetails: z.string().trim().max(2000).optional(),
  refundAmount: z.coerce.number().min(0, "Refund cannot be negative").default(0),
  refundStatus: z.enum(REFUND_STATUSES).default("NOT_REQUIRED"),
  adminNotes: z.string().trim().max(2000).optional(),
});

type SelectedLine = { orderItemId: number; quantity: number; restoreStock: boolean };

/**
 * Line selections arrive as `include-<id>` / `qty-<id>` / `restore-<id>` so the
 * create form can be a plain progressively-enhanced `<form>`.
 */
function readLines(formData: FormData): SelectedLine[] {
  const lines: SelectedLine[] = [];

  for (const key of formData.keys()) {
    if (!key.startsWith("include-")) continue;

    const orderItemId = Number(key.slice("include-".length));
    if (!Number.isInteger(orderItemId) || orderItemId <= 0) continue;
    if (lines.some((l) => l.orderItemId === orderItemId)) continue;

    const quantity = Number(formData.get(`qty-${orderItemId}`) ?? 0);
    lines.push({
      orderItemId,
      quantity: Number.isFinite(quantity) ? Math.trunc(quantity) : 0,
      restoreStock: formData.get(`restore-${orderItemId}`) !== null,
    });
  }

  return lines;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * Record a return against an order.
 *
 * Differences from legacy, deliberately: legacy always returned the *whole*
 * order (no quantity input at all), allowed exactly one return per order, and
 * credited variant stock *and* product stock for the same unit — double
 * counting inventory on every variant sale. Here each line is chosen with a
 * quantity, capped by what is left to return, and stock goes back to whichever
 * row reserved it.
 */
export async function createReturn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = returnSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const selected = readLines(formData).filter((l) => l.quantity > 0);
  if (selected.length === 0) {
    return { ok: false, message: "Choose at least one item and a quantity to return." };
  }

  const order = await prisma.order.findFirst({
    where: { id: d.orderId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      totalAmount: true,
      items: {
        select: {
          id: true,
          productId: true,
          variantId: true,
          productName: true,
          variantInfo: true,
          quantity: true,
          unitPrice: true,
          isGift: true,
        },
      },
    },
  });
  if (!order) return { ok: false, message: "That order no longer exists." };

  // Everything already returned against this order, so a line cannot be
  // returned more times than it was bought.
  const priorRows = await prisma.returnItem.groupBy({
    by: ["orderItemId"],
    where: { return: { orderId: order.id } },
    _sum: { quantity: true },
  });
  const prior = new Map(priorRows.map((r) => [r.orderItemId, r._sum.quantity ?? 0]));

  const resolved: {
    line: SelectedLine;
    item: (typeof order.items)[number];
  }[] = [];

  for (const line of selected) {
    const item = order.items.find((i) => i.id === line.orderItemId);
    if (!item) return { ok: false, message: "That order line is not on this order." };

    const remaining = item.quantity - (prior.get(item.id) ?? 0);
    if (remaining <= 0) {
      return {
        ok: false,
        message: `“${item.productName}” has already been returned in full.`,
      };
    }
    if (line.quantity > remaining) {
      return {
        ok: false,
        message: `You can return at most ${remaining} × “${item.productName}”.`,
      };
    }
    resolved.push({ line, item });
  }

  const orderTotal = Number(order.totalAmount);
  if (d.refundAmount > orderTotal) {
    return {
      ok: false,
      errors: { refundAmount: ["Refund cannot exceed the order total"] },
    };
  }

  let created: { id: number } | null = null;

  // Return numbers are random, so retry the rare collision rather than
  // pre-checking — same approach as `generateOrderNumber`.
  for (let attempt = 0; attempt < 5 && created === null; attempt++) {
    try {
      created = await prisma.$transaction(async (tx) => {
        const row = await tx.return.create({
          data: {
            storeId: DEFAULT_STORE_ID,
            orderId: order.id,
            returnNumber: generateReturnNumber(),
            reason: d.reason,
            reasonDetails: d.reasonDetails || null,
            refundAmount: Math.round(d.refundAmount * 100) / 100,
            refundStatus: d.refundStatus,
            adminNotes: d.adminNotes || null,
            items: {
              create: resolved.map(({ line, item }) => ({
                orderItemId: item.id,
                productId: item.productId,
                variantId: item.variantId,
                productName: item.productName,
                variantInfo: item.variantInfo,
                quantity: line.quantity,
                unitPrice: item.unitPrice,
                // Gift lines never reserved stock, so they can never restore it.
                stockRestored: line.restoreStock && !item.isGift,
              })),
            },
          },
          select: { id: true },
        });

        for (const { line, item } of resolved) {
          if (!line.restoreStock || item.isGift) continue;

          if (item.variantId !== null) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQuantity: { increment: line.quantity } },
            });
          } else if (item.productId !== null) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: line.quantity } },
            });
          }
        }

        return row;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  if (created === null) {
    return { ok: false, message: "Could not allocate a return number. Try again." };
  }

  revalidatePath("/admin/returns");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.id}`);
  revalidatePath("/admin/products");

  redirect(`/admin/returns/${created.id}?created=1`);
}

const updateSchema = z.object({
  refundAmount: z.coerce.number().min(0, "Refund cannot be negative").default(0),
  refundStatus: z.enum(REFUND_STATUSES),
  adminNotes: z.string().trim().max(2000).optional(),
});

export async function updateReturn(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const existing = await prisma.return.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, order: { select: { totalAmount: true } } },
  });
  if (!existing) return { ok: false, message: "That return no longer exists." };

  if (d.refundAmount > Number(existing.order.totalAmount)) {
    return {
      ok: false,
      errors: { refundAmount: ["Refund cannot exceed the order total"] },
    };
  }

  await prisma.return.update({
    where: { id },
    data: {
      refundAmount: Math.round(d.refundAmount * 100) / 100,
      refundStatus: d.refundStatus,
      adminNotes: d.adminNotes || null,
    },
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${id}`);
  return { ok: true, message: "Return saved." };
}

/**
 * Delete a return and undo its inventory effect.
 *
 * Legacy hard-deleted the row and left the restored stock behind, so
 * delete-then-recreate silently inflated inventory. The decrements are guarded
 * so a concurrent sale can never push a row negative.
 */
export async function deleteReturn(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.return.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      orderId: true,
      items: {
        select: { productId: true, variantId: true, quantity: true, stockRestored: true },
      },
    },
  });
  if (!existing) return { ok: false, message: "That return no longer exists." };

  let short = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of existing.items) {
      if (!item.stockRestored || item.quantity <= 0) continue;

      if (item.variantId !== null) {
        const res = await tx.productVariant.updateMany({
          where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (res.count === 0) short++;
      } else if (item.productId !== null) {
        const res = await tx.product.updateMany({
          where: { id: item.productId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (res.count === 0) short++;
      }
    }

    await tx.return.delete({ where: { id } });
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/orders/${existing.orderId}`);
  revalidatePath("/admin/products");

  return {
    ok: true,
    message: short
      ? `Return deleted, but ${short} line${short === 1 ? "" : "s"} could not have its stock taken back out. Check inventory.`
      : "Return deleted and the restored stock was taken back out.",
  };
}
