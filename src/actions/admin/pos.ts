"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrors, type FormState } from "@/actions/types";
import type { Prisma } from "@/generated/prisma";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { effectivePrice, toNumber, type Money } from "@/lib/money";
import {
  computeTotals,
  generateHoldNumber,
  generateRefundNumber,
  generateShiftNumber,
  generateTransactionNumber,
  heldItemsSchema,
  lineTotal,
  parseHeldItems,
  parseRefundedItems,
  POS_PAYMENT_METHODS,
  POS_REFUND_METHODS,
  round2,
  type CompleteSaleInput,
  type HeldItem,
  type ProcessRefundInput,
  type RefundedItem,
} from "@/lib/pos";
import { prisma } from "@/lib/prisma";

/* -------------------------------------------------------------------------
   POS server actions.

   Every mutation re-derives money and stock from the database. The legacy
   controller trusted the POST body for prices, tax and totals, so a crafted
   request could sell a BDT 12,000 saree for nothing.
   ------------------------------------------------------------------------- */

class PosError extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function revalidatePos() {
  revalidatePath("/admin/pos");
  revalidatePath("/admin/pos/transactions");
  revalidatePath("/admin/pos/shifts");
}

/** The caller's open shift, or null. One open shift per user per store. */
async function openShiftFor(userId: number) {
  return prisma.posShift.findFirst({
    where: { userId, storeId: DEFAULT_STORE_ID, status: "OPEN" },
    select: {
      id: true,
      shiftNumber: true,
      terminalId: true,
      openingCash: true,
      totalSales: true,
      totalTransactions: true,
      openingTime: true,
      terminal: { select: { id: true, name: true } },
    },
  });
}

/* ------------------------------------------------------------------ shifts */

const openShiftSchema = z.object({
  terminalId: z.coerce.number().int().positive().optional(),
  openingCash: z.coerce.number().min(0, "Opening cash cannot be negative").default(0),
});

/**
 * A store with no terminal yet gets one, so a fresh install can start selling.
 * Legacy rendered an empty `<select>` and silently inserted `terminal_id = 0`.
 */
async function ensureTerminal(storeId: number) {
  const existing = await prisma.posTerminal.findFirst({
    where: { storeId, isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return prisma.posTerminal.create({
    data: { storeId, name: "Counter 1", code: "T1", isActive: true },
    select: { id: true, name: true },
  });
}

export async function openShift(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();

  const parsed = openShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const existing = await openShiftFor(user.id);
  if (existing) {
    return { ok: false, message: "You already have an open shift." };
  }

  let terminalId = parsed.data.terminalId ?? null;
  if (terminalId) {
    // Never trust a terminal id from the client.
    const terminal = await prisma.posTerminal.findFirst({
      where: { id: terminalId, storeId: DEFAULT_STORE_ID, isActive: true },
      select: { id: true },
    });
    if (!terminal) return { ok: false, errors: { terminalId: ["Choose a valid terminal"] } };
  } else {
    terminalId = (await ensureTerminal(DEFAULT_STORE_ID)).id;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.posShift.create({
        data: {
          storeId: DEFAULT_STORE_ID,
          terminalId,
          userId: user.id,
          shiftNumber: generateShiftNumber(),
          openingTime: new Date(),
          openingCash: parsed.data.openingCash,
          status: "OPEN",
        },
        select: { id: true },
      });
      revalidatePos();
      return { ok: true, message: "Shift opened." };
    } catch (error) {
      if (attempt === 4 || !isUniqueViolation(error)) {
        console.error("Could not open shift", error);
        return { ok: false, message: "Could not open the shift. Please try again." };
      }
    }
  }

  return { ok: false, message: "Could not allocate a shift number." };
}

/**
 * Expected cash for a shift:
 * opening float + cash taken + cash in − cash out − cash refunds.
 *
 * Cash taken counts `cashReceived − changeAmount`, which is the money actually
 * left in the drawer, for both CASH and MIXED sales.
 */
async function shiftCashPosition(shiftId: number) {
  const [transactions, cashLogs, refunds] = await Promise.all([
    prisma.posTransaction.findMany({
      where: { shiftId, status: { not: "VOID" } },
      select: {
        totalAmount: true,
        cashReceived: true,
        changeAmount: true,
        paymentMethod: true,
      },
    }),
    prisma.posCashLog.findMany({
      where: { shiftId },
      select: { type: true, amount: true },
    }),
    prisma.posRefund.findMany({
      where: { shiftId, status: "COMPLETED" },
      select: {
        refundAmount: true,
        refundMethod: true,
        transaction: { select: { paymentMethod: true } },
      },
    }),
  ]);

  let cashTaken = 0;
  let totalSales = 0;
  for (const t of transactions) {
    totalSales += toNumber(t.totalAmount);
    if (t.paymentMethod === "CASH" || t.paymentMethod === "MIXED") {
      cashTaken += toNumber(t.cashReceived) - toNumber(t.changeAmount);
    }
  }

  let cashIn = 0;
  let cashOut = 0;
  for (const log of cashLogs) {
    const amount = toNumber(log.amount);
    if (log.type === "CASH_OUT") cashOut += amount;
    else cashIn += amount; // CASH_IN and ADJUSTMENT both add to the drawer.
  }

  let cashRefunds = 0;
  let totalRefunds = 0;
  for (const r of refunds) {
    const amount = toNumber(r.refundAmount);
    totalRefunds += amount;
    const paidInCash =
      r.refundMethod === "CASH" ||
      (r.refundMethod === "ORIGINAL_METHOD" &&
        (r.transaction.paymentMethod === "CASH" || r.transaction.paymentMethod === "MIXED"));
    if (paidInCash) cashRefunds += amount;
  }

  return {
    cashTaken: round2(cashTaken),
    cashIn: round2(cashIn),
    cashOut: round2(cashOut),
    cashRefunds: round2(cashRefunds),
    totalSales: round2(totalSales),
    totalRefunds: round2(totalRefunds),
    totalTransactions: transactions.length,
  };
}

/** Read-only cash position, for the close-shift screen's "expected" figure. */
export async function getShiftCashPosition(shiftId: number) {
  const user = await requireStaff();

  const shift = await prisma.posShift.findFirst({
    where: { id: shiftId, storeId: DEFAULT_STORE_ID },
    select: { id: true, userId: true, openingCash: true, status: true },
  });
  if (!shift) return null;
  if (shift.userId !== user.id && user.role !== "ADMIN") return null;

  const position = await shiftCashPosition(shiftId);
  const openingCash = toNumber(shift.openingCash);

  return {
    ...position,
    openingCash,
    expectedCash: round2(
      openingCash +
        position.cashTaken +
        position.cashIn -
        position.cashOut -
        position.cashRefunds,
    ),
  };
}

const closeShiftSchema = z.object({
  shiftId: z.coerce.number().int().positive(),
  actualCash: z.coerce.number().min(0, "Counted cash cannot be negative"),
  notes: z.string().trim().max(1000).optional(),
});

export async function closeShift(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();

  const parsed = closeShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const { shiftId, actualCash, notes } = parsed.data;

  const shift = await prisma.posShift.findFirst({
    where: { id: shiftId, storeId: DEFAULT_STORE_ID },
    select: { id: true, userId: true, status: true, openingCash: true },
  });
  if (!shift) return { ok: false, message: "That shift no longer exists." };
  if (shift.status === "CLOSED") return { ok: false, message: "That shift is already closed." };
  if (shift.userId !== user.id && user.role !== "ADMIN") {
    return { ok: false, message: "Only the cashier who opened this shift can close it." };
  }

  const position = await shiftCashPosition(shiftId);
  const openingCash = toNumber(shift.openingCash);
  const expectedCash = round2(
    openingCash + position.cashTaken + position.cashIn - position.cashOut - position.cashRefunds,
  );

  await prisma.posShift.update({
    where: { id: shiftId },
    data: {
      status: "CLOSED",
      closingTime: new Date(),
      expectedCash,
      actualCash,
      cashDifference: round2(actualCash - expectedCash),
      totalSales: position.totalSales,
      totalTransactions: position.totalTransactions,
      totalRefunds: position.totalRefunds,
      notes: notes || null,
    },
  });

  revalidatePos();
  revalidatePath(`/admin/pos/shifts/${shiftId}`);
  return { ok: true, message: "Shift closed." };
}

const cashLogSchema = z.object({
  type: z.enum(["CASH_IN", "CASH_OUT", "ADJUSTMENT"]),
  amount: z.coerce.number().positive("Enter an amount above zero"),
  reason: z.string().trim().min(2, "Give a reason").max(255),
});

export async function recordCashLog(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = cashLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const shift = await openShiftFor(user.id);
  if (!shift) return { ok: false, message: "Open a shift before moving cash." };

  await prisma.posCashLog.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      shiftId: shift.id,
      type: parsed.data.type,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      createdById: user.id,
    },
    select: { id: true },
  });

  revalidatePos();
  revalidatePath(`/admin/pos/shifts/${shift.id}`);
  return { ok: true, message: "Cash movement recorded." };
}

/* ------------------------------------------------------------------ lookup */

export type PosProductRow = {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  image: string | null;
};

const productSelect = {
  id: true,
  name: true,
  sku: true,
  barcode: true,
  price: true,
  salePrice: true,
  stockQuantity: true,
  images: {
    select: { path: true },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    take: 1,
  },
} satisfies Prisma.ProductSelect;

type RawProduct = {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: Money;
  salePrice: Money;
  stockQuantity: number;
  images: { path: string }[];
};

function toProductRow(p: RawProduct): PosProductRow {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    price: effectivePrice(p.price, p.salePrice),
    stock: p.stockQuantity,
    image: imageUrl(p.images[0]?.path),
  };
}

/** Catalogue search for the terminal, beyond the pre-loaded page of products. */
export async function searchPosProducts(query: string): Promise<PosProductRow[]> {
  await requireStaff();

  const q = query.trim();
  if (q.length < 2) return [];

  const products = await prisma.product.findMany({
    where: {
      storeId: DEFAULT_STORE_ID,
      status: "ACTIVE",
      OR: [{ name: { contains: q } }, { sku: { contains: q } }, { barcode: { contains: q } }],
    },
    orderBy: { name: "asc" },
    take: 40,
    select: productSelect,
  });

  return products.map(toProductRow);
}

/** Exact barcode/SKU match — the scanner path, so no fuzzy fallback. */
export async function lookupBarcode(code: string): Promise<PosProductRow | null> {
  await requireStaff();

  const value = code.trim();
  if (!value) return null;

  const product = await prisma.product.findFirst({
    where: {
      storeId: DEFAULT_STORE_ID,
      status: "ACTIVE",
      OR: [{ barcode: value }, { sku: value }],
    },
    select: productSelect,
  });

  return product ? toProductRow(product) : null;
}

export type PosCustomerRow = {
  id: number;
  name: string;
  phone: string | null;
  email: string;
};

export async function searchPosCustomers(query: string): Promise<PosCustomerRow[]> {
  await requireStaff();

  const q = query.trim();
  if (q.length < 2) return [];

  return prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      OR: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }],
    },
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true, phone: true, email: true },
  });
}

/* -------------------------------------------------------------------- sale */

const saleItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(9999),
  discount: z.coerce.number().min(0).default(0),
});

const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Add at least one item"),
  customerId: z.coerce.number().int().positive().nullable().optional(),
  customerName: z.string().trim().max(255).optional(),
  customerPhone: z.string().trim().max(50).optional(),
  orderDiscount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(POS_PAYMENT_METHODS),
  cashReceived: z.coerce.number().min(0).default(0),
  cardAmount: z.coerce.number().min(0).default(0),
  mobileAmount: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(1000).optional(),
});

export type CompleteSaleResult = FormState & {
  transactionId?: number;
  transactionNumber?: string;
  changeAmount?: number;
};

export async function completeSale(input: CompleteSaleInput): Promise<CompleteSaleResult> {
  const user = await requireStaff();

  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      ...fieldErrors(flat.fieldErrors),
      message: flat.formErrors[0] ?? "Please check the sale details.",
    };
  }
  const d = parsed.data;

  const shift = await openShiftFor(user.id);
  if (!shift) return { ok: false, message: "Open a shift before taking a sale." };

  if (d.customerId) {
    const customer = await prisma.user.findFirst({
      where: { id: d.customerId, role: "CUSTOMER" },
      select: { id: true },
    });
    if (!customer) return { ok: false, message: "That customer no longer exists." };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      // The shift could have been closed on another till since we read it.
      const live = await tx.posShift.findFirst({
        where: { id: shift.id, status: "OPEN" },
        select: { id: true, terminalId: true },
      });
      if (!live) throw new PosError("Your shift was closed. Open a new one to continue.");

      const products = await tx.product.findMany({
        where: {
          id: { in: d.items.map((i) => i.productId) },
          storeId: DEFAULT_STORE_ID,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          salePrice: true,
          status: true,
        },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      const variantIds = d.items
        .map((i) => i.variantId)
        .filter((v): v is number => typeof v === "number");
      const variants =
        variantIds.length > 0
          ? await tx.productVariant.findMany({
              where: { id: { in: variantIds } },
              select: {
                id: true,
                productId: true,
                size: true,
                colorName: true,
                sku: true,
                priceModifier: true,
              },
            })
          : [];
      const variantById = new Map(variants.map((v) => [v.id, v]));

      // Prices come from the database, never from the till.
      const lines = d.items.map((item) => {
        const product = byId.get(item.productId);
        if (!product) throw new PosError("An item in the cart no longer exists.");
        if (product.status !== "ACTIVE") {
          throw new PosError(`${product.name} is no longer available for sale.`);
        }

        const variant = item.variantId ? variantById.get(item.variantId) : undefined;
        if (item.variantId && (!variant || variant.productId !== product.id)) {
          throw new PosError(`A selected option for ${product.name} is no longer available.`);
        }

        const unitPrice = round2(
          effectivePrice(product.price, product.salePrice) +
            (variant ? toNumber(variant.priceModifier) : 0),
        );
        const gross = round2(unitPrice * item.quantity);
        // A line discount larger than the line would make the sale negative.
        const discount = round2(Math.min(Math.max(0, item.discount), gross));

        return {
          productId: product.id,
          variantId: variant?.id ?? null,
          productName: product.name,
          productSku: variant?.sku ?? product.sku,
          variantInfo: variant
            ? [variant.size, variant.colorName].filter(Boolean).join(" / ") || null
            : null,
          quantity: item.quantity,
          unitPrice,
          discount,
          totalPrice: lineTotal({ unitPrice, quantity: item.quantity, discount }),
        };
      });

      const totals = computeTotals(lines, d.orderDiscount);

      // Payment validation, server-side. Legacy accepted any amount.
      let cashReceived = 0;
      let cardAmount = 0;
      let mobileAmount = 0;
      let changeAmount = 0;

      if (d.paymentMethod === "CASH") {
        cashReceived = d.cashReceived;
        if (cashReceived + 0.005 < totals.total) {
          throw new PosError("Cash received is less than the total due.");
        }
        changeAmount = round2(cashReceived - totals.total);
      } else if (d.paymentMethod === "CARD") {
        cardAmount = totals.total;
      } else if (d.paymentMethod === "MOBILE_BANKING") {
        mobileAmount = totals.total;
      } else {
        cashReceived = d.cashReceived;
        cardAmount = d.cardAmount;
        mobileAmount = d.mobileAmount;
        const sum = round2(cashReceived + cardAmount + mobileAmount);
        if (Math.abs(sum - totals.total) > 0.01) {
          throw new PosError("The split payments must add up to the total due.");
        }
      }

      // Conditional stock decrement. A bare `stock = stock - qty`, as legacy
      // used, lets two tills sell the same last item and drives stock negative.
      for (const line of lines) {
        const result = line.variantId
          ? await tx.productVariant.updateMany({
              where: { id: line.variantId, stockQuantity: { gte: line.quantity } },
              data: { stockQuantity: { decrement: line.quantity } },
            })
          : await tx.product.updateMany({
              where: { id: line.productId, stockQuantity: { gte: line.quantity } },
              data: { stockQuantity: { decrement: line.quantity } },
            });

        if (result.count === 0) {
          throw new PosError(`Not enough stock for ${line.productName}.`);
        }
      }

      let transaction: { id: number; transactionNumber: string } | null = null;
      for (let attempt = 0; attempt < 5 && !transaction; attempt++) {
        try {
          transaction = await tx.posTransaction.create({
            data: {
              storeId: DEFAULT_STORE_ID,
              shiftId: live.id,
              terminalId: live.terminalId,
              transactionNumber: generateTransactionNumber(),
              customerId: d.customerId ?? null,
              customerName: d.customerName || null,
              customerPhone: d.customerPhone || null,
              subtotal: totals.subtotal,
              discountAmount: totals.discount,
              taxAmount: totals.tax,
              totalAmount: totals.total,
              paymentMethod: d.paymentMethod,
              cashReceived,
              changeAmount,
              cardAmount,
              mobileAmount,
              status: "COMPLETED",
              notes: d.notes || null,
              createdById: user.id,
              items: {
                create: lines.map((l) => ({
                  productId: l.productId,
                  variantId: l.variantId,
                  productName: l.productName,
                  productSku: l.productSku,
                  variantInfo: l.variantInfo,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discount: l.discount,
                  totalPrice: l.totalPrice,
                })),
              },
            },
            select: { id: true, transactionNumber: true },
          });
        } catch (error) {
          if (attempt === 4 || !isUniqueViolation(error)) throw error;
        }
      }
      if (!transaction) throw new PosError("Could not allocate a transaction number.");
      const txn = transaction;

      if (d.paymentMethod === "MIXED") {
        const splits = [
          { paymentMethod: "CASH" as const, amount: cashReceived },
          { paymentMethod: "CARD" as const, amount: cardAmount },
          { paymentMethod: "MOBILE_BANKING" as const, amount: mobileAmount },
        ].filter((s) => s.amount > 0);

        await tx.posSplitPayment.createMany({
          data: splits.map((s) => ({
            transactionId: txn.id,
            paymentMethod: s.paymentMethod,
            amount: s.amount,
          })),
        });
      }

      await tx.posShift.update({
        where: { id: live.id },
        data: {
          totalSales: { increment: totals.total },
          totalTransactions: { increment: 1 },
        },
      });

      return { ...txn, changeAmount };
    });

    revalidatePos();
    revalidatePath("/admin/products");

    return {
      ok: true,
      message: "Sale completed.",
      transactionId: created.id,
      transactionNumber: created.transactionNumber,
      changeAmount: created.changeAmount,
    };
  } catch (error) {
    if (error instanceof PosError) return { ok: false, message: error.message };
    console.error("POS sale failed", error);
    return { ok: false, message: "Could not complete the sale. Please try again." };
  }
}

/* ------------------------------------------------------------- held orders */

const holdSchema = z.object({
  items: heldItemsSchema.min(1, "Nothing to hold"),
  customerId: z.coerce.number().int().positive().nullable().optional(),
  customerName: z.string().trim().max(255).optional(),
  customerPhone: z.string().trim().max(50).optional(),
  note: z.string().trim().max(500).optional(),
});

export async function holdOrder(input: {
  items: HeldItem[];
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string;
  note?: string;
}): Promise<FormState> {
  const user = await requireStaff();

  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Add an item before holding the order." };
  }

  const shift = await openShiftFor(user.id);
  if (!shift) return { ok: false, message: "Open a shift before holding an order." };

  const d = parsed.data;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.posHeldOrder.create({
        data: {
          storeId: DEFAULT_STORE_ID,
          shiftId: shift.id,
          terminalId: shift.terminalId,
          holdNumber: generateHoldNumber(),
          customerId: d.customerId ?? null,
          customerName: d.customerName || null,
          customerPhone: d.customerPhone || null,
          items: d.items,
          note: d.note || null,
          status: "HELD",
          heldById: user.id,
        },
        select: { id: true },
      });
      revalidatePath("/admin/pos");
      return { ok: true, message: "Order held." };
    } catch (error) {
      if (attempt === 4 || !isUniqueViolation(error)) {
        console.error("Could not hold order", error);
        return { ok: false, message: "Could not hold the order." };
      }
    }
  }

  return { ok: false, message: "Could not allocate a hold number." };
}

export type RecalledOrder = {
  items: HeldItem[];
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
};

export async function recallHeldOrder(
  id: number,
): Promise<FormState & { order?: RecalledOrder }> {
  await requireStaff();

  const held = await prisma.posHeldOrder.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID, status: "HELD" },
    select: {
      id: true,
      items: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
    },
  });
  if (!held) return { ok: false, message: "That held order is no longer available." };

  const items = parseHeldItems(held.items);
  if (items.length === 0) {
    return { ok: false, message: "That held order has no readable items." };
  }

  // Legacy deleted the row on recall, losing the audit trail. Mark it instead.
  await prisma.posHeldOrder.update({
    where: { id },
    data: { status: "RECALLED", recalledAt: new Date() },
  });

  revalidatePath("/admin/pos");
  return {
    ok: true,
    message: "Order recalled.",
    order: {
      items,
      customerId: held.customerId,
      customerName: held.customerName,
      customerPhone: held.customerPhone,
    },
  };
}

export async function deleteHeldOrder(id: number): Promise<FormState> {
  await requireStaff();

  const held = await prisma.posHeldOrder.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!held) return { ok: false, message: "That held order no longer exists." };

  await prisma.posHeldOrder.delete({ where: { id } });
  revalidatePath("/admin/pos");
  return { ok: true, message: "Held order deleted." };
}

/* ----------------------------------------------------------------- refunds */

export type RefundLookupItem = {
  id: number;
  productName: string;
  productSku: string | null;
  variantInfo: string | null;
  quantity: number;
  refundedQuantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type RefundLookup = {
  id: number;
  transactionNumber: string;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string;
  status: string;
  totalAmount: number;
  refundedAmount: number;
  refundableAmount: number;
  cashierName: string | null;
  items: RefundLookupItem[];
};

/** Per-item quantities already refunded, read back out of the refund Json. */
async function refundedQuantities(transactionId: number): Promise<Map<number, number>> {
  const refunds = await prisma.posRefund.findMany({
    where: { transactionId, status: "COMPLETED" },
    select: { items: true },
  });

  const map = new Map<number, number>();
  for (const refund of refunds) {
    for (const item of parseRefundedItems(refund.items)) {
      map.set(item.itemId, (map.get(item.itemId) ?? 0) + item.quantity);
    }
  }
  return map;
}

export async function lookupTransactionForRefund(
  transactionNumber: string,
): Promise<FormState & { transaction?: RefundLookup }> {
  await requireStaff();

  const number = transactionNumber.trim();
  if (!number) return { ok: false, message: "Enter a transaction number." };

  const transaction = await prisma.posTransaction.findFirst({
    where: { transactionNumber: number, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      transactionNumber: true,
      createdAt: true,
      customerName: true,
      customerPhone: true,
      paymentMethod: true,
      status: true,
      totalAmount: true,
      refundedAmount: true,
      createdBy: { select: { name: true } },
      items: {
        select: {
          id: true,
          productName: true,
          productSku: true,
          variantInfo: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!transaction) return { ok: false, message: "No transaction with that number." };
  if (transaction.status === "VOID") {
    return { ok: false, message: "That transaction was voided and cannot be refunded." };
  }

  const alreadyRefunded = await refundedQuantities(transaction.id);
  const total = toNumber(transaction.totalAmount);
  const refunded = toNumber(transaction.refundedAmount);

  return {
    ok: true,
    transaction: {
      id: transaction.id,
      transactionNumber: transaction.transactionNumber,
      createdAt: transaction.createdAt.toISOString(),
      customerName: transaction.customerName,
      customerPhone: transaction.customerPhone,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      totalAmount: total,
      refundedAmount: refunded,
      refundableAmount: round2(Math.max(0, total - refunded)),
      cashierName: transaction.createdBy?.name ?? null,
      items: transaction.items.map((i) => ({
        id: i.id,
        productName: i.productName,
        productSku: i.productSku,
        variantInfo: i.variantInfo,
        quantity: i.quantity,
        refundedQuantity: alreadyRefunded.get(i.id) ?? 0,
        unitPrice: toNumber(i.unitPrice),
        totalPrice: toNumber(i.totalPrice),
      })),
    },
  };
}

const refundSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
  items: z
    .array(
      z.object({
        itemId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1),
      }),
    )
    .min(1, "Select at least one item to refund"),
  reason: z.string().trim().min(3, "Give a refund reason").max(100),
  refundMethod: z.enum(POS_REFUND_METHODS),
  notes: z.string().trim().max(1000).optional(),
});

export type ProcessRefundResult = FormState & {
  refundNumber?: string;
  refundAmount?: number;
};

export async function processRefund(
  input: ProcessRefundInput,
): Promise<ProcessRefundResult> {
  const user = await requireStaff();

  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      ...fieldErrors(flat.fieldErrors),
      message: flat.formErrors[0] ?? "Please check the refund details.",
    };
  }
  const d = parsed.data;

  const shift = await openShiftFor(user.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.posTransaction.findFirst({
        where: { id: d.transactionId, storeId: DEFAULT_STORE_ID },
        select: {
          id: true,
          shiftId: true,
          terminalId: true,
          status: true,
          customerId: true,
          customerName: true,
          totalAmount: true,
          refundedAmount: true,
          items: {
            select: {
              id: true,
              productId: true,
              variantId: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
      });
      if (!transaction) throw new PosError("That transaction no longer exists.");
      if (transaction.status === "VOID") {
        throw new PosError("That transaction was voided and cannot be refunded.");
      }

      const itemsById = new Map(transaction.items.map((i) => [i.id, i]));

      // Re-read prior refunds inside the transaction, so two clerks refunding
      // the same sale at once cannot both pass the remaining-quantity check.
      const priorRefunds = await tx.posRefund.findMany({
        where: { transactionId: transaction.id, status: "COMPLETED" },
        select: { items: true },
      });
      const already = new Map<number, number>();
      for (const refund of priorRefunds) {
        for (const item of parseRefundedItems(refund.items)) {
          already.set(item.itemId, (already.get(item.itemId) ?? 0) + item.quantity);
        }
      }

      const seen = new Set<number>();
      let refundAmount = 0;
      const refundedItems: RefundedItem[] = [];

      for (const requested of d.items) {
        if (seen.has(requested.itemId)) {
          throw new PosError("The same line was listed twice.");
        }
        seen.add(requested.itemId);

        const item = itemsById.get(requested.itemId);
        if (!item) throw new PosError("An item on this refund is not on that transaction.");

        const remaining = item.quantity - (already.get(item.id) ?? 0);
        if (requested.quantity > remaining) {
          throw new PosError(
            `Only ${remaining} of ${item.productName} can still be refunded.`,
          );
        }

        // Refund at the line's effective per-unit price, so a line discount is
        // honoured. Legacy trusted a client-sent price.
        const perUnit = round2(toNumber(item.totalPrice) / item.quantity);
        const amount = round2(perUnit * requested.quantity);
        refundAmount = round2(refundAmount + amount);

        refundedItems.push({
          itemId: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: requested.quantity,
          unitPrice: perUnit,
          amount,
        });

        // Put the goods back.
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: requested.quantity } },
          });
        } else if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: requested.quantity } },
          });
        }
      }

      const total = toNumber(transaction.totalAmount);
      const alreadyRefunded = toNumber(transaction.refundedAmount);
      if (refundAmount > round2(total - alreadyRefunded) + 0.01) {
        throw new PosError("That is more than the un-refunded balance of this sale.");
      }

      const refundShiftId = shift?.id ?? transaction.shiftId;

      let refund: { id: number; refundNumber: string } | null = null;
      for (let attempt = 0; attempt < 5 && !refund; attempt++) {
        try {
          refund = await tx.posRefund.create({
            data: {
              storeId: DEFAULT_STORE_ID,
              shiftId: refundShiftId,
              terminalId: shift?.terminalId ?? transaction.terminalId,
              transactionId: transaction.id,
              refundNumber: generateRefundNumber(),
              customerId: transaction.customerId,
              customerName: transaction.customerName,
              refundAmount,
              refundMethod: d.refundMethod,
              reason: d.reason,
              items: refundedItems,
              notes: d.notes || null,
              status: "COMPLETED",
              createdById: user.id,
            },
            select: { id: true, refundNumber: true },
          });
        } catch (error) {
          if (attempt === 4 || !isUniqueViolation(error)) throw error;
        }
      }
      if (!refund) throw new PosError("Could not allocate a refund number.");

      const newRefunded = round2(alreadyRefunded + refundAmount);
      await tx.posTransaction.update({
        where: { id: transaction.id },
        data: {
          refundedAmount: newRefunded,
          // Only a full refund flips the status; a partial one stays COMPLETED
          // because the schema has no PARTIAL_REFUND member.
          ...(newRefunded + 0.01 >= total ? { status: "REFUNDED" as const } : {}),
        },
      });

      if (refundShiftId) {
        await tx.posShift.update({
          where: { id: refundShiftId },
          data: { totalRefunds: { increment: refundAmount } },
        });
      }

      return { refundNumber: refund.refundNumber, refundAmount };
    });

    revalidatePos();
    revalidatePath(`/admin/pos/transactions/${d.transactionId}`);
    revalidatePath("/admin/products");

    return {
      ok: true,
      message: `Refund ${result.refundNumber} processed.`,
      refundNumber: result.refundNumber,
      refundAmount: result.refundAmount,
    };
  } catch (error) {
    if (error instanceof PosError) return { ok: false, message: error.message };
    console.error("POS refund failed", error);
    return { ok: false, message: "Could not process the refund. Please try again." };
  }
}
