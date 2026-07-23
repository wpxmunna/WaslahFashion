"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrors, type FormState } from "@/actions/types";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_COUNTRY, DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { generateOrderNumber } from "@/lib/order-number";
import { prisma } from "@/lib/prisma";
import { compareVariants } from "@/lib/variants";

const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

const SHIPMENT_STATUSES = [
  "PENDING",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
] as const;

type OrderStatusValue = (typeof ORDER_STATUSES)[number];

/**
 * Cancelled and refunded orders no longer hold their stock reservation.
 * Every other status does.
 */
function holdsStock(status: OrderStatusValue): boolean {
  return status !== "CANCELLED" && status !== "REFUNDED";
}

/** Line types that actually consumed inventory when the order was placed. */
type StockLine = {
  productId: number | null;
  variantId: number | null;
  quantity: number;
};

/**
 * Gift lines are added by a coupon and never reserved stock, so returning them
 * to inventory would invent units that were never taken out.
 */
function stockLines(items: (StockLine & { isGift: boolean })[]): StockLine[] {
  return items.filter(
    (i) => !i.isGift && i.quantity > 0 && (i.variantId !== null || i.productId !== null),
  );
}

/**
 * Move a single order status, keeping inventory in step.
 *
 * Legacy never restored stock on cancellation at all — cancelled orders simply
 * leaked their reservation. We restore it, but the write has to be idempotent:
 * an admin flipping PENDING → CANCELLED → REFUNDED must not credit the same
 * units twice, and neither must two concurrent requests. The guarded
 * `updateMany` claims the transition atomically; only the writer that actually
 * changed the row moves stock.
 *
 * Moving back out of a cancelled state re-reserves the stock, so a
 * cancel/reinstate cycle nets to zero instead of inflating inventory.
 */
export async function updateOrderStatus(
  orderId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = z
    .object({ status: z.enum(ORDER_STATUSES) })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Choose a valid order status.",
    };
  }

  const next = parsed.data.status;

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      status: true,
      items: {
        select: { productId: true, variantId: true, quantity: true, isGift: true },
      },
    },
  });
  if (!order) return { ok: false, message: "That order no longer exists." };

  const lines = stockLines(order.items);
  const restoring = holdsStock(order.status) && !holdsStock(next);
  const reserving = !holdsStock(order.status) && holdsStock(next);

  let moved = false;
  let short = 0;

  await prisma.$transaction(async (tx) => {
    if (!restoring && !reserving) {
      await tx.order.update({ where: { id: orderId }, data: { status: next } });
      return;
    }

    // Claim the transition. `count === 0` means another writer got there first
    // and already moved the stock, so we only mirror the status.
    const claimed = await tx.order.updateMany({
      where: {
        id: orderId,
        status: restoring
          ? { notIn: ["CANCELLED", "REFUNDED"] }
          : { in: ["CANCELLED", "REFUNDED"] },
      },
      data: { status: next },
    });

    if (claimed.count === 0) {
      await tx.order.update({ where: { id: orderId }, data: { status: next } });
      return;
    }

    moved = true;

    for (const line of lines) {
      if (restoring) {
        if (line.variantId !== null) {
          await tx.productVariant.update({
            where: { id: line.variantId },
            data: { stockQuantity: { increment: line.quantity } },
          });
        } else if (line.productId !== null) {
          await tx.product.update({
            where: { id: line.productId },
            data: { stockQuantity: { increment: line.quantity } },
          });
        }
        continue;
      }

      // Re-reserving: guarded so a concurrent sale can never drive stock negative.
      if (line.variantId !== null) {
        const res = await tx.productVariant.updateMany({
          where: { id: line.variantId, stockQuantity: { gte: line.quantity } },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if (res.count === 0) short++;
      } else if (line.productId !== null) {
        const res = await tx.product.updateMany({
          where: { id: line.productId, stockQuantity: { gte: line.quantity } },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if (res.count === 0) short++;
      }
    }
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");

  if (moved && restoring) {
    return {
      ok: true,
      message: `Order marked ${next.toLowerCase()}. Stock was returned to inventory for ${lines.length} line${lines.length === 1 ? "" : "s"}.`,
    };
  }
  if (moved && reserving) {
    return {
      ok: true,
      message: short
        ? `Order reopened, but ${short} line${short === 1 ? "" : "s"} could not be re-reserved because stock has since sold out. Check inventory.`
        : "Order reopened and its stock was reserved again.",
    };
  }
  return { ok: true, message: "Order status updated." };
}

export async function updateOrderPaymentStatus(
  orderId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = z
    .object({ paymentStatus: z.enum(PAYMENT_STATUSES) })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Choose a valid payment status.",
    };
  }

  const updated = await prisma.order.updateMany({
    where: { id: orderId, storeId: DEFAULT_STORE_ID },
    data: { paymentStatus: parsed.data.paymentStatus },
  });
  if (updated.count === 0) return { ok: false, message: "That order no longer exists." };

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Payment status updated." };
}

const shipmentSchema = z.object({
  courierId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "" || v === null) return null;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : null;
    }),
  trackingNumber: z.string().trim().max(100).optional(),
  status: z.enum(SHIPMENT_STATUSES).default("PENDING"),
  note: z.string().trim().max(255).optional(),
});

/**
 * Assign or update the courier and tracking number, creating the shipment row
 * on first use. Each change appends a tracking event so the timeline on the
 * detail page reflects what the shop actually did, not just the courier feed.
 */
export async function updateOrderShipment(
  orderId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = shipmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      shipment: { select: { id: true, status: true, shippedAt: true } },
    },
  });
  if (!order) return { ok: false, message: "That order no longer exists." };

  // Never trust a courier id from the form — it has to belong to this store.
  let courierName: string | null = null;
  if (d.courierId !== null) {
    const courier = await prisma.courier.findFirst({
      where: { id: d.courierId, storeId: DEFAULT_STORE_ID },
      select: { name: true },
    });
    if (!courier) {
      return { ok: false, errors: { courierId: ["That courier is not available"] } };
    }
    courierName = courier.name;
  }

  const now = new Date();
  const shipped = d.status !== "PENDING" ? now : null;
  const delivered = d.status === "DELIVERED" ? now : null;

  await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.upsert({
      where: { orderId },
      create: {
        orderId,
        courierId: d.courierId,
        courierName,
        trackingNumber: d.trackingNumber || null,
        status: d.status,
        shippedAt: shipped,
        deliveredAt: delivered,
      },
      update: {
        courierId: d.courierId,
        courierName,
        trackingNumber: d.trackingNumber || null,
        status: d.status,
        // Keep the first despatch timestamp; only fill it if still unset.
        ...(shipped && !order.shipment?.shippedAt ? { shippedAt: shipped } : {}),
        ...(delivered ? { deliveredAt: delivered } : {}),
      },
      select: { id: true },
    });

    const changed = order.shipment?.status !== d.status;
    if (changed || d.note) {
      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: d.status,
          description:
            d.note ||
            (order.shipment
              ? "Status updated by store staff."
              : "Shipment created by store staff."),
        },
      });
    }
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Shipping details saved." };
}

/**
 * Append to the admin note trail. Legacy overwrote the field wholesale, so any
 * earlier context was lost the moment a second admin typed into it.
 */
export async function appendOrderNote(
  orderId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = z
    .object({ note: z.string().trim().min(1, "Write a note first").max(2000) })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: DEFAULT_STORE_ID },
    select: { adminNotes: true },
  });
  if (!order) return { ok: false, message: "That order no longer exists." };

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = `[${stamp} · ${user.name}]\n${parsed.data.note}`;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      adminNotes: order.adminNotes ? `${order.adminNotes}\n\n${entry}` : entry,
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Note added." };
}

/* ------------------------------------------------------- manual order create

   Staff create orders that arrived off-site (Facebook, WhatsApp, phone). Prices
   are entered by staff (they often negotiate), but product/variant names are
   snapshotted server-side and stock is decremented with the same guarded
   updateMany the customer checkout uses, so a manual order can never oversell.
   -------------------------------------------------------------------------- */

const round2 = (n: number) => Math.round(n * 100) / 100;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

class ManualStockError extends Error {
  constructor(public itemName: string) {
    super(itemName);
    this.name = "ManualStockError";
  }
}

export type OrderableVariant = {
  id: number;
  label: string;
  priceModifier: number;
  stock: number;
};

/** Active variants for a product, for the manual-order line picker. */
export async function getOrderableVariants(productId: number): Promise<OrderableVariant[]> {
  await requireStaff();
  const rows = await prisma.productVariant.findMany({
    where: { productId, isActive: true },
    select: {
      id: true,
      size: true,
      colorName: true,
      color: { select: { name: true } },
      priceModifier: true,
      stockQuantity: true,
    },
  });
  return rows
    .map((v) => ({
      id: v.id,
      size: v.size,
      colorName: v.colorName ?? v.color?.name ?? null,
      priceModifier: toNumber(v.priceModifier),
      stock: v.stockQuantity,
    }))
    .sort(compareVariants)
    .map((v) => ({
      id: v.id,
      label: [v.size, v.colorName].filter(Boolean).join(" / ") || "Variant",
      priceModifier: v.priceModifier,
      stock: v.stock,
    }));
}

const manualLineSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable(),
  quantity: z.number().int().min(1).max(9999),
  unitPrice: z.number().min(0).max(10_000_000),
});

const manualOrderSchema = z.object({
  customerId: z.number().int().positive().nullable(),
  shippingName: z.string().trim().min(2, "Enter the customer name"),
  shippingPhone: z.string().trim().min(6, "Enter a contact phone").max(20),
  shippingLine1: z.string().trim().min(3, "Enter an address"),
  shippingLine2: z.string().trim().optional(),
  shippingCity: z.string().trim().min(2, "Enter a city"),
  shippingState: z.string().trim().optional(),
  shippingPostalCode: z.string().trim().optional(),
  paymentMethod: z.string().trim().min(1),
  status: z.enum(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"]),
  paymentStatus: z.enum(["PENDING", "PAID"]),
  shippingAmount: z.number().min(0).max(1_000_000),
  discountAmount: z.number().min(0).max(10_000_000),
  source: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(manualLineSchema).min(1, "Add at least one product"),
});

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;
export type CreateOrderResult =
  | { ok: true; orderId: number; orderNumber: string }
  | { ok: false; message: string };

export async function createManualOrder(input: ManualOrderInput): Promise<CreateOrderResult> {
  const staff = await requireStaff();

  const parsed = manualOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the order." };
  }
  const d = parsed.data;

  const productIds = [...new Set(d.lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      name: true,
      sku: true,
      variants: {
        select: { id: true, size: true, colorName: true, color: { select: { name: true } } },
      },
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const resolved: {
    productId: number;
    variantId: number | null;
    productName: string;
    productSku: string | null;
    variantInfo: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[] = [];

  for (const line of d.lines) {
    const product = productMap.get(line.productId);
    if (!product) return { ok: false, message: "A selected product no longer exists." };
    let variantInfo: string | null = null;
    if (line.variantId) {
      const v = product.variants.find((x) => x.id === line.variantId);
      if (!v) return { ok: false, message: `A selected option for ${product.name} is invalid.` };
      variantInfo = [v.size, v.colorName ?? v.color?.name].filter(Boolean).join(" / ") || null;
    }
    resolved.push({
      productId: product.id,
      variantId: line.variantId,
      productName: product.name,
      productSku: product.sku,
      variantInfo,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      totalPrice: round2(line.unitPrice * line.quantity),
    });
  }

  const subtotal = round2(resolved.reduce((s, l) => s + l.totalPrice, 0));
  const total = Math.max(0, round2(subtotal + d.shippingAmount - d.discountAmount));

  let userId: number | null = null;
  if (d.customerId) {
    const cust = await prisma.user.findFirst({
      where: { id: d.customerId, role: "CUSTOMER" },
      select: { id: true },
    });
    userId = cust?.id ?? null;
  }

  const adminNote = `Created manually by ${staff.name}${d.source ? ` · source: ${d.source}` : ""}`;

  try {
    const order = await prisma.$transaction(async (tx) => {
      for (const l of resolved) {
        const result = l.variantId
          ? await tx.productVariant.updateMany({
              where: { id: l.variantId, stockQuantity: { gte: l.quantity } },
              data: { stockQuantity: { decrement: l.quantity } },
            })
          : await tx.product.updateMany({
              where: { id: l.productId, stockQuantity: { gte: l.quantity } },
              data: { stockQuantity: { decrement: l.quantity } },
            });
        if (result.count === 0) throw new ManualStockError(l.productName);
      }

      let created = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const candidate = generateOrderNumber();
        try {
          created = await tx.order.create({
            data: {
              storeId: DEFAULT_STORE_ID,
              userId,
              orderNumber: candidate,
              status: d.status,
              paymentStatus: d.paymentStatus,
              paymentMethod: d.paymentMethod,
              subtotal,
              discountAmount: d.discountAmount,
              taxAmount: 0,
              shippingAmount: d.shippingAmount,
              totalAmount: total,
              shippingName: d.shippingName,
              shippingPhone: d.shippingPhone,
              shippingLine1: d.shippingLine1,
              shippingLine2: d.shippingLine2 || null,
              shippingCity: d.shippingCity,
              shippingState: d.shippingState || null,
              shippingPostalCode: d.shippingPostalCode || null,
              shippingCountry: DEFAULT_COUNTRY,
              billingName: d.shippingName,
              billingPhone: d.shippingPhone,
              billingLine1: d.shippingLine1,
              billingLine2: d.shippingLine2 || null,
              billingCity: d.shippingCity,
              billingState: d.shippingState || null,
              billingPostalCode: d.shippingPostalCode || null,
              billingCountry: DEFAULT_COUNTRY,
              notes: d.notes || null,
              adminNotes: adminNote,
              items: {
                create: resolved.map((l) => ({
                  productId: l.productId,
                  variantId: l.variantId,
                  productName: l.productName,
                  productSku: l.productSku,
                  variantInfo: l.variantInfo,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  totalPrice: l.totalPrice,
                })),
              },
            },
          });
        } catch (error) {
          if (attempt === 4 || !isUniqueViolation(error)) throw error;
        }
      }
      if (!created) throw new Error("Could not allocate an order number");

      await tx.payment.create({
        data: {
          orderId: created.id,
          gateway: d.paymentMethod,
          method: d.paymentMethod,
          amount: total,
          currency: "BDT",
          status: d.paymentStatus === "PAID" ? "PAID" : "PENDING",
        },
      });

      return created;
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true, orderId: order.id, orderNumber: order.orderNumber };
  } catch (error) {
    if (error instanceof ManualStockError) {
      return { ok: false, message: `${error.itemName} doesn't have enough stock.` };
    }
    console.error("Manual order creation failed", error);
    return { ok: false, message: "Could not create the order. Please try again." };
  }
}

/* --------------------------------------------------------- edit an order

   Add/remove/adjust line items and the shipping address after an order exists.
   Stock is kept in step (only while the order still holds its reservation —
   i.e. not cancelled/refunded), and the order totals are recomputed from the
   line items every time.
   -------------------------------------------------------------------------- */

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function recomputeOrderTotals(tx: TxClient, orderId: number): Promise<void> {
  const [items, order] = await Promise.all([
    tx.orderItem.findMany({ where: { orderId }, select: { totalPrice: true } }),
    tx.order.findUnique({
      where: { id: orderId },
      select: { shippingAmount: true, taxAmount: true, discountAmount: true },
    }),
  ]);
  if (!order) return;
  const subtotal = round2(items.reduce((s, i) => s + toNumber(i.totalPrice), 0));
  const total = Math.max(
    0,
    round2(
      subtotal + toNumber(order.shippingAmount) + toNumber(order.taxAmount) - toNumber(order.discountAmount),
    ),
  );
  await tx.order.update({ where: { id: orderId }, data: { subtotal, totalAmount: total } });
}

export async function addOrderItem(
  orderId: number,
  input: { productId: number; variantId: number | null; quantity: number; unitPrice: number },
): Promise<FormState> {
  await requireStaff();

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: DEFAULT_STORE_ID },
    select: { id: true, status: true },
  });
  if (!order) return { ok: false, message: "Order not found." };

  const product = await prisma.product.findFirst({
    where: { id: input.productId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      name: true,
      sku: true,
      variants: { select: { id: true, size: true, colorName: true, color: { select: { name: true } } } },
    },
  });
  if (!product) return { ok: false, message: "Product not found." };

  let variantInfo: string | null = null;
  if (input.variantId) {
    const v = product.variants.find((x) => x.id === input.variantId);
    if (!v) return { ok: false, message: "Invalid product option." };
    variantInfo = [v.size, v.colorName ?? v.color?.name].filter(Boolean).join(" / ") || null;
  }

  const qty = Math.max(1, Math.trunc(input.quantity));
  const unitPrice = Math.max(0, input.unitPrice);

  try {
    await prisma.$transaction(async (tx) => {
      if (holdsStock(order.status as OrderStatusValue)) {
        const res = input.variantId
          ? await tx.productVariant.updateMany({
              where: { id: input.variantId, stockQuantity: { gte: qty } },
              data: { stockQuantity: { decrement: qty } },
            })
          : await tx.product.updateMany({
              where: { id: input.productId, stockQuantity: { gte: qty } },
              data: { stockQuantity: { decrement: qty } },
            });
        if (res.count === 0) throw new ManualStockError(product.name);
      }
      await tx.orderItem.create({
        data: {
          orderId,
          productId: product.id,
          variantId: input.variantId,
          productName: product.name,
          productSku: product.sku,
          variantInfo,
          quantity: qty,
          unitPrice,
          totalPrice: round2(unitPrice * qty),
        },
      });
      await recomputeOrderTotals(tx, orderId);
    });
  } catch (error) {
    if (error instanceof ManualStockError) {
      return { ok: false, message: `${error.itemName} doesn't have enough stock.` };
    }
    throw error;
  }

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Item added." };
}

export async function updateOrderItemQuantity(
  itemId: number,
  quantity: number,
): Promise<FormState> {
  await requireStaff();

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      productId: true,
      variantId: true,
      productName: true,
      isGift: true,
      order: { select: { id: true, status: true, storeId: true } },
    },
  });
  if (!item || item.order.storeId !== DEFAULT_STORE_ID) {
    return { ok: false, message: "Line not found." };
  }

  const newQty = Math.max(1, Math.trunc(quantity));
  const delta = newQty - item.quantity;

  try {
    await prisma.$transaction(async (tx) => {
      if (!item.isGift && holdsStock(item.order.status as OrderStatusValue) && delta !== 0) {
        if (delta > 0) {
          const res = item.variantId
            ? await tx.productVariant.updateMany({
                where: { id: item.variantId, stockQuantity: { gte: delta } },
                data: { stockQuantity: { decrement: delta } },
              })
            : await tx.product.updateMany({
                where: { id: item.productId!, stockQuantity: { gte: delta } },
                data: { stockQuantity: { decrement: delta } },
              });
          if (res.count === 0) throw new ManualStockError(item.productName);
        } else {
          const inc = -delta;
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stockQuantity: { increment: inc } },
            });
          } else if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: inc } },
            });
          }
        }
      }
      await tx.orderItem.update({
        where: { id: itemId },
        data: { quantity: newQty, totalPrice: round2(toNumber(item.unitPrice) * newQty) },
      });
      await recomputeOrderTotals(tx, item.order.id);
    });
  } catch (error) {
    if (error instanceof ManualStockError) {
      return { ok: false, message: `${error.itemName} doesn't have enough stock.` };
    }
    throw error;
  }

  revalidatePath(`/admin/orders/${item.order.id}`);
  return { ok: true, message: "Quantity updated." };
}

export async function removeOrderItem(itemId: number): Promise<FormState> {
  await requireStaff();

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      quantity: true,
      productId: true,
      variantId: true,
      isGift: true,
      order: { select: { id: true, status: true, storeId: true, _count: { select: { items: true } } } },
    },
  });
  if (!item || item.order.storeId !== DEFAULT_STORE_ID) {
    return { ok: false, message: "Line not found." };
  }
  if (item.order._count.items <= 1) {
    return { ok: false, message: "An order must keep at least one item. Cancel the order instead." };
  }

  await prisma.$transaction(async (tx) => {
    if (!item.isGift && holdsStock(item.order.status as OrderStatusValue)) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      } else if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
    }
    await tx.orderItem.delete({ where: { id: itemId } });
    await recomputeOrderTotals(tx, item.order.id);
  });

  revalidatePath(`/admin/orders/${item.order.id}`);
  return { ok: true, message: "Item removed." };
}

const orderAddressSchema = z.object({
  shippingName: z.string().trim().min(2, "Enter a name"),
  shippingPhone: z.string().trim().min(6, "Enter a phone").max(20),
  shippingLine1: z.string().trim().min(3, "Enter an address"),
  shippingLine2: z.string().trim().optional(),
  shippingCity: z.string().trim().min(2, "Enter a city"),
  shippingState: z.string().trim().optional(),
  shippingPostalCode: z.string().trim().optional(),
});

export async function updateOrderAddress(
  orderId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = orderAddressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }
  const d = parsed.data;

  const exists = await prisma.order.findFirst({
    where: { id: orderId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!exists) return { ok: false, message: "Order not found." };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      shippingName: d.shippingName,
      shippingPhone: d.shippingPhone,
      shippingLine1: d.shippingLine1,
      shippingLine2: d.shippingLine2 || null,
      shippingCity: d.shippingCity,
      shippingState: d.shippingState || null,
      shippingPostalCode: d.shippingPostalCode || null,
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Delivery details updated." };
}
