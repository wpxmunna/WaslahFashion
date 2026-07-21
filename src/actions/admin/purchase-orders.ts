"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { generatePoNumber, withUniqueDocNumber } from "@/lib/doc-number";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

type PoStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "ORDERED"
  | "PARTIAL"
  | "RECEIVED"
  | "CANCELLED";

/**
 * Legal status moves. Legacy had no transition table at all — `status` was a
 * free-text POST field, so a draft could be set straight to `received` from the
 * dropdown without any stock ever being booked in.
 *
 * PARTIAL and RECEIVED are reachable only through `receiveStock`, never as a
 * manual pick; `manualTransition` filters them out.
 */
const TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  DRAFT: ["PENDING", "CANCELLED"],
  PENDING: ["DRAFT", "APPROVED", "CANCELLED"],
  APPROVED: ["ORDERED", "PARTIAL", "RECEIVED", "CANCELLED"],
  ORDERED: ["PARTIAL", "RECEIVED", "CANCELLED"],
  PARTIAL: ["PARTIAL", "RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
};

/** Sentinel for a concurrent receipt losing the guarded update race. */
const RECEIPT_CONFLICT = "RECEIPT_CONFLICT";

/** Statuses whose lines an operator may still edit. */
const EDITABLE: PoStatus[] = ["DRAFT", "PENDING"];
/** Statuses that may take a stock receipt. */
const RECEIVABLE: PoStatus[] = ["APPROVED", "ORDERED", "PARTIAL"];

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const poSchema = z.object({
  supplierId: z.coerce.number().int().positive("Choose a supplier"),
  orderDate: z.string().trim().min(1, "Choose an order date"),
  expectedDate: z.string().trim().optional(),
  status: z.enum(["DRAFT", "PENDING"]).default("DRAFT"),
  taxAmount: z.coerce.number().min(0, "Tax cannot be negative").default(0),
  shippingAmount: z.coerce.number().min(0, "Shipping cannot be negative").default(0),
  discountAmount: z.coerce.number().min(0, "Discount cannot be negative").default(0),
  notes: z.string().trim().optional(),
});

type ParsedLine = {
  productId: number | null;
  productName: string;
  productSku: string | null;
  quantityOrdered: number;
  unitCost: number;
  totalCost: number;
};

/**
 * Read the dynamic line-item rows. The editor posts index-aligned repeated
 * fields, so a row is only kept when it carries a name, a positive quantity and
 * a non-negative cost — matching the legacy filter but with real validation.
 */
function readLines(formData: FormData): { lines: ParsedLine[]; error?: string } {
  const productIds = formData.getAll("itemProductId");
  const names = formData.getAll("itemProductName");
  const quantities = formData.getAll("itemQuantity");
  const costs = formData.getAll("itemUnitCost");

  const rows = Math.max(names.length, quantities.length, costs.length);
  const lines: ParsedLine[] = [];

  for (let i = 0; i < rows; i++) {
    const name = String(names[i] ?? "").trim();
    const rawQty = String(quantities[i] ?? "").trim();
    const rawCost = String(costs[i] ?? "").trim();
    const rawProductId = String(productIds[i] ?? "").trim();

    // A wholly blank row is the empty editor row, not an error.
    if (!name && !rawQty && !rawCost && !rawProductId) continue;

    if (!name) return { lines: [], error: `Line ${i + 1} needs a product name.` };

    const quantity = Number(rawQty);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { lines: [], error: `Line ${i + 1} needs a whole quantity above zero.` };
    }

    const unitCost = Number(rawCost);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      return { lines: [], error: `Line ${i + 1} needs a unit cost of zero or more.` };
    }

    const productId = rawProductId === "" ? null : Number(rawProductId);
    if (productId !== null && !Number.isInteger(productId)) {
      return { lines: [], error: `Line ${i + 1} has an invalid product.` };
    }

    lines.push({
      productId,
      productName: name.slice(0, 255),
      productSku: null,
      quantityOrdered: quantity,
      unitCost: round2(unitCost),
      totalCost: round2(quantity * unitCost),
    });
  }

  if (lines.length === 0) return { lines: [], error: "Add at least one line item." };
  return { lines };
}

/** Resolve and store-check the products referenced by the lines. */
async function attachProducts(lines: ParsedLine[]): Promise<ParsedLine[] | string> {
  const ids = [...new Set(lines.map((l) => l.productId).filter((id): id is number => id !== null))];
  if (ids.length === 0) return lines;

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, storeId: DEFAULT_STORE_ID },
    select: { id: true, name: true, sku: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return lines.map((line) => {
    if (line.productId === null) return line;
    const product = byId.get(line.productId);
    // An id that is not in this store is treated as a free-text line rather
    // than silently writing a foreign product reference.
    if (!product) return { ...line, productId: null };
    return { ...line, productName: product.name, productSku: product.sku };
  });
}

function rollUp(
  lines: ParsedLine[],
  tax: number,
  shipping: number,
  discount: number,
) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.totalCost, 0));
  // Discount applies after tax and shipping, as the legacy totals did, so the
  // stored figures stay comparable with historical rows.
  const totalAmount = round2(Math.max(0, subtotal + tax + shipping - discount));
  return { subtotal, totalAmount };
}

async function findPo(id: number) {
  if (!Number.isInteger(id)) return null;
  return prisma.purchaseOrder.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      status: true,
      supplierId: true,
      totalAmount: true,
      paidAmount: true,
      poNumber: true,
    },
  });
}

export async function createPurchaseOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = poSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const supplier = await prisma.supplier.findFirst({
    where: { id: d.supplierId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!supplier) return { ok: false, errors: { supplierId: ["Choose a supplier"] } };

  const orderDate = parseDateOnly(d.orderDate);
  if (!orderDate) return { ok: false, errors: { orderDate: ["Enter a valid date"] } };

  const expectedDate = d.expectedDate ? parseDateOnly(d.expectedDate) : null;
  if (d.expectedDate && !expectedDate) {
    return { ok: false, errors: { expectedDate: ["Enter a valid date"] } };
  }

  const read = readLines(formData);
  if (read.error) return { ok: false, message: read.error };

  const resolved = await attachProducts(read.lines);
  if (typeof resolved === "string") return { ok: false, message: resolved };

  const { subtotal, totalAmount } = rollUp(
    resolved,
    d.taxAmount,
    d.shippingAmount,
    d.discountAmount,
  );

  const po = await withUniqueDocNumber(generatePoNumber, (poNumber) =>
    prisma.purchaseOrder.create({
      data: {
        storeId: DEFAULT_STORE_ID,
        supplierId: d.supplierId,
        poNumber,
        status: d.status,
        orderDate,
        expectedDate,
        subtotal,
        taxAmount: round2(d.taxAmount),
        shippingAmount: round2(d.shippingAmount),
        discountAmount: round2(d.discountAmount),
        totalAmount,
        notes: d.notes || null,
        createdById: user.id,
        items: {
          create: resolved.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            productSku: l.productSku,
            quantityOrdered: l.quantityOrdered,
            unitCost: l.unitCost,
            totalCost: l.totalCost,
          })),
        },
      },
      select: { id: true },
    }),
  );

  revalidatePath("/admin/purchase-orders");
  revalidatePath(`/admin/suppliers/${d.supplierId}`);
  redirect(`/admin/purchase-orders/${po.id}?created=1`);
}

export async function updatePurchaseOrder(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const existing = await findPo(id);
  if (!existing) return { ok: false, message: "That purchase order no longer exists." };

  if (!EDITABLE.includes(existing.status as PoStatus)) {
    return {
      ok: false,
      message: `A ${existing.status.toLowerCase()} purchase order can no longer be edited.`,
    };
  }

  const parsed = poSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const supplier = await prisma.supplier.findFirst({
    where: { id: d.supplierId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!supplier) return { ok: false, errors: { supplierId: ["Choose a supplier"] } };

  const orderDate = parseDateOnly(d.orderDate);
  if (!orderDate) return { ok: false, errors: { orderDate: ["Enter a valid date"] } };

  const expectedDate = d.expectedDate ? parseDateOnly(d.expectedDate) : null;
  if (d.expectedDate && !expectedDate) {
    return { ok: false, errors: { expectedDate: ["Enter a valid date"] } };
  }

  // Legacy deleted and re-inserted the lines, resetting `quantity_received` to
  // zero and silently destroying receipt history. Editing is gated to
  // DRAFT/PENDING so nothing should be received yet — but check rather than
  // assume, because the cost of being wrong is unaccounted stock.
  const received = await prisma.purchaseOrderItem.count({
    where: { purchaseOrderId: id, quantityReceived: { gt: 0 } },
  });
  if (received > 0) {
    return {
      ok: false,
      message: "Some lines already have stock booked in, so this order cannot be edited.",
    };
  }

  const read = readLines(formData);
  if (read.error) return { ok: false, message: read.error };

  const resolved = await attachProducts(read.lines);
  if (typeof resolved === "string") return { ok: false, message: resolved };

  const { subtotal, totalAmount } = rollUp(
    resolved,
    d.taxAmount,
    d.shippingAmount,
    d.discountAmount,
  );

  // A changed total re-derives the payment status; legacy left a PO marked
  // `paid` after its total was raised.
  const paid = round2(Number(existing.paidAmount));
  const paidCents = Math.round(paid * 100);
  const totalCents = Math.round(totalAmount * 100);
  const paymentStatus =
    paidCents >= totalCents && totalCents > 0
      ? "PAID"
      : paidCents > 0
        ? "PARTIAL"
        : "PENDING";

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    await tx.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: d.supplierId,
        status: d.status,
        orderDate,
        expectedDate,
        subtotal,
        taxAmount: round2(d.taxAmount),
        shippingAmount: round2(d.shippingAmount),
        discountAmount: round2(d.discountAmount),
        totalAmount,
        paymentStatus,
        notes: d.notes || null,
        items: {
          create: resolved.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            productSku: l.productSku,
            quantityOrdered: l.quantityOrdered,
            unitCost: l.unitCost,
            totalCost: l.totalCost,
          })),
        },
      },
    });
  });

  revalidatePath("/admin/purchase-orders");
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath(`/admin/suppliers/${d.supplierId}`);
  return { ok: true, message: "Purchase order saved." };
}

/**
 * Move a purchase order along the workflow. Rejects any move the transition
 * table does not allow, and refuses the receipt-driven statuses outright —
 * PARTIAL and RECEIVED are earned by booking stock in, not chosen.
 */
export async function changePurchaseOrderStatus(
  id: number,
  next: string,
): Promise<FormState> {
  const user = await requireStaff();

  const existing = await findPo(id);
  if (!existing) return { ok: false, message: "That purchase order no longer exists." };

  const target = next as PoStatus;
  if (!(target in TRANSITIONS)) {
    return { ok: false, message: "That is not a valid status." };
  }

  if (target === "PARTIAL" || target === "RECEIVED") {
    return {
      ok: false,
      message: "Receive the stock to move this order to partial or received.",
    };
  }

  const from = existing.status as PoStatus;
  if (!TRANSITIONS[from].includes(target)) {
    return {
      ok: false,
      message: `A ${from.toLowerCase()} purchase order cannot move to ${target.toLowerCase()}.`,
    };
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: target,
      ...(target === "APPROVED"
        ? { approvedById: user.id, approvedAt: new Date() }
        : {}),
    },
  });

  revalidatePath("/admin/purchase-orders");
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath(`/admin/suppliers/${existing.supplierId}`);

  return { ok: true, message: `Purchase order marked ${target.toLowerCase()}.` };
}

export async function deletePurchaseOrder(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await findPo(id);
  if (!existing) return { ok: false, message: "That purchase order no longer exists." };

  if (!EDITABLE.includes(existing.status as PoStatus)) {
    return {
      ok: false,
      message:
        "Only a draft or pending purchase order can be deleted. Cancel this one instead.",
    };
  }

  const payments = await prisma.supplierPayment.count({ where: { purchaseOrderId: id } });
  if (payments > 0) {
    return {
      ok: false,
      message: "This order has payments recorded against it, so it cannot be deleted.",
    };
  }

  await prisma.purchaseOrder.delete({ where: { id } });

  revalidatePath("/admin/purchase-orders");
  revalidatePath(`/admin/suppliers/${existing.supplierId}`);
  return { ok: true, message: "Purchase order deleted." };
}

/* -------------------------------------------------------------------------
   Receiving stock
   ------------------------------------------------------------------------- */

/**
 * Book received quantities against the order's lines and into stock.
 *
 * Everything happens in one transaction: line receipts, product stock, the
 * order's status and received date, and the supplier's lifetime purchase total.
 *
 * Legacy's `processReceipt` had no status guard (you could receive into a
 * cancelled order by posting straight to the URL), no over-receipt clamp, and
 * no transaction.
 */
export async function receivePurchaseOrderStock(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      status: true,
      supplierId: true,
      totalAmount: true,
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          quantityOrdered: true,
          quantityReceived: true,
        },
      },
    },
  });
  if (!po) return { ok: false, message: "That purchase order no longer exists." };

  if (!RECEIVABLE.includes(po.status as PoStatus)) {
    return {
      ok: false,
      message: `Stock cannot be received against a ${po.status.toLowerCase()} purchase order.`,
    };
  }

  const ids = formData.getAll("receiveItemId");
  const quantities = formData.getAll("receiveQuantity");

  const byId = new Map(po.items.map((item) => [item.id, item]));
  const receipts: { itemId: number; productId: number | null; quantity: number }[] = [];

  for (let i = 0; i < ids.length; i++) {
    const itemId = Number(String(ids[i] ?? "").trim());
    if (!Number.isInteger(itemId)) continue;

    // The posted id must belong to *this* order — legacy relied on the lookup
    // happening to miss, rather than rejecting the input.
    const item = byId.get(itemId);
    if (!item) {
      return { ok: false, message: "That receipt refers to a line on another order." };
    }

    const raw = String(quantities[i] ?? "").trim();
    if (raw === "") continue;

    const quantity = Number(raw);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return {
        ok: false,
        message: `Enter a whole quantity of zero or more for ${item.productName}.`,
      };
    }
    if (quantity === 0) continue;

    const outstanding = item.quantityOrdered - item.quantityReceived;
    if (quantity > outstanding) {
      return {
        ok: false,
        message: `${item.productName}: only ${outstanding} left to receive, but ${quantity} was entered.`,
      };
    }

    receipts.push({ itemId, productId: item.productId, quantity });
  }

  if (receipts.length === 0) {
    return { ok: false, message: "Enter a quantity against at least one line." };
  }

  const receivedById = new Map(receipts.map((r) => [r.itemId, r.quantity]));

  // Will every line be complete once these receipts land?
  const allReceived = po.items.every(
    (item) =>
      item.quantityReceived + (receivedById.get(item.id) ?? 0) >= item.quantityOrdered,
  );

  const nextStatus: PoStatus = allReceived ? "RECEIVED" : "PARTIAL";
  if (!TRANSITIONS[po.status as PoStatus].includes(nextStatus)) {
    return { ok: false, message: "This order cannot move to that status." };
  }

  // Only the first arrival at RECEIVED adds to the supplier's lifetime
  // purchases, so a re-receipt cannot double-count.
  const countPurchase = nextStatus === "RECEIVED" && po.status !== "RECEIVED";
  const poTotal = round2(Number(po.totalAmount));

  try {
    await prisma.$transaction(async (tx) => {
      for (const receipt of receipts) {
        // Guarded update: the row must still be short by at least this much, so
        // two concurrent receipts cannot push a line past what was ordered.
        const ordered = byId.get(receipt.itemId)?.quantityOrdered ?? 0;

        const updated = await tx.purchaseOrderItem.updateMany({
          where: {
            id: receipt.itemId,
            purchaseOrderId: po.id,
            quantityReceived: { lte: ordered - receipt.quantity },
          },
          data: { quantityReceived: { increment: receipt.quantity } },
        });

        if (updated.count === 0) throw new Error(RECEIPT_CONFLICT);

        if (receipt.productId !== null) {
          await tx.product.update({
            where: { id: receipt.productId },
            data: { stockQuantity: { increment: receipt.quantity } },
          });
        }
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: nextStatus,
          ...(nextStatus === "RECEIVED" ? { receivedDate: new Date() } : {}),
        },
      });

      if (countPurchase) {
        await tx.supplier.update({
          where: { id: po.supplierId },
          data: { totalPurchases: { increment: poTotal } },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === RECEIPT_CONFLICT) {
      return {
        ok: false,
        message:
          "Someone else received stock against this order while you were working. Reload and try again.",
      };
    }
    throw error;
  }

  revalidatePath("/admin/purchase-orders");
  revalidatePath(`/admin/purchase-orders/${id}`);
  revalidatePath(`/admin/suppliers/${po.supplierId}`);
  revalidatePath("/admin/products");

  return {
    ok: true,
    message: allReceived
      ? "All lines received. The order is now complete."
      : "Stock received. The order is partially received.",
  };
}
