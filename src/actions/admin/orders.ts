"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrors, type FormState } from "@/actions/types";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

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
