"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { computeTotals, getCartView, resolveCart, variantLabel } from "@/lib/cart";
import { DEFAULT_COUNTRY, DEFAULT_STORE_ID } from "@/lib/config";
import { evaluateCoupon } from "@/lib/coupons";
import { generateOrderNumber } from "@/lib/order-number";
import { isPaymentMethod } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { getShippingSettings } from "@/lib/settings";
import { fieldErrors, type FormState } from "./types";

const checkoutSchema = z.object({
  shippingName: z.string().trim().min(2, "Enter the recipient's name"),
  shippingPhone: z
    .string()
    .trim()
    .min(6, "Enter a contact phone number")
    .max(20, "That phone number looks too long"),
  shippingLine1: z.string().trim().min(4, "Enter a street address"),
  shippingLine2: z.string().trim().optional(),
  shippingCity: z.string().trim().min(2, "Enter a city"),
  shippingState: z.string().trim().optional(),
  shippingPostalCode: z.string().trim().optional(),
  paymentMethod: z.string().refine(isPaymentMethod, "Choose a payment method"),
  courierId: z.coerce.number().int().positive().optional(),
  couponCode: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** Coupon preview for the checkout page. Never trusts a client-sent subtotal. */
export async function applyCoupon(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = String(formData.get("couponCode") ?? "").trim();
  if (!code) return { ok: false, message: "Enter a coupon code." };

  const { lines, totals } = await getCartView();
  if (lines.length === 0) return { ok: false, message: "Your bag is empty." };

  const result = await evaluateCoupon(code, lines, totals.subtotal, totals.shipping);
  return result.valid
    ? { ok: true, message: result.message }
    : { ok: false, message: result.message };
}

export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));

  // Legacy validated none of this — an order could be placed with an empty
  // name, phone and address.
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const input = parsed.data;
  const session = await getSession();

  const cart = await resolveCart();
  if (!cart) return { ok: false, message: "Your bag is empty." };

  const { lines, totals } = await getCartView();
  if (lines.length === 0) return { ok: false, message: "Your bag is empty." };

  const problems = lines.filter((l) => l.hasIssue);
  if (problems.length > 0) {
    return {
      ok: false,
      message: `Some items are no longer available: ${problems
        .map((p) => `${p.name} (${p.issue})`)
        .join(", ")}`,
    };
  }

  // Re-validate the coupon server-side against our own subtotal.
  let couponId: number | null = null;
  let couponCode: string | null = null;
  let discount = 0;
  let shipping = totals.shipping;
  let giftProductId: number | null = null;
  let giftProductName: string | null = null;

  if (input.couponCode) {
    const evaluation = await evaluateCoupon(
      input.couponCode,
      lines,
      totals.subtotal,
      totals.shipping,
    );

    if (evaluation.valid) {
      couponId = evaluation.coupon.id;
      couponCode = evaluation.coupon.code;
      if (evaluation.freeShipping) {
        shipping = 0;
      } else {
        discount = evaluation.discount;
      }
      if (evaluation.giftProduct) {
        giftProductId = evaluation.giftProduct.id;
        giftProductName = evaluation.giftProduct.name;
      }
    } else {
      // Legacy silently dropped invalid coupons and charged full price.
      return { ok: false, message: evaluation.message };
    }
  }

  const recomputed = computeTotals(lines, await getShippingSettings());
  const total = Math.max(0, recomputed.subtotal + shipping + recomputed.tax - discount);

  let orderNumber = "";

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Decrement stock conditionally. Legacy issued a bare
      // `stock_quantity = stock_quantity - ?`, so two concurrent orders for the
      // last item both succeeded and drove stock negative. `updateMany` with a
      // `gte` guard makes the decrement fail closed instead.
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
          throw new OutOfStockError(line.name);
        }
      }

      // Retry on the (astronomically unlikely) order-number collision.
      let created = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        const candidate = generateOrderNumber();
        try {
          created = await tx.order.create({
            data: {
              storeId: DEFAULT_STORE_ID,
              userId: session?.userId ?? null,
              orderNumber: candidate,
              status: "PENDING",
              paymentStatus: "PENDING",
              paymentMethod: input.paymentMethod,
              subtotal: recomputed.subtotal,
              couponId,
              couponCode,
              discountAmount: discount,
              taxAmount: recomputed.tax,
              shippingAmount: shipping,
              totalAmount: total,

              shippingName: input.shippingName,
              shippingPhone: input.shippingPhone,
              shippingLine1: input.shippingLine1,
              shippingLine2: input.shippingLine2 || null,
              shippingCity: input.shippingCity,
              shippingState: input.shippingState || null,
              shippingPostalCode: input.shippingPostalCode || null,
              shippingCountry: DEFAULT_COUNTRY,

              // Billing mirrors shipping, as in the legacy checkout.
              billingName: input.shippingName,
              billingPhone: input.shippingPhone,
              billingLine1: input.shippingLine1,
              billingLine2: input.shippingLine2 || null,
              billingCity: input.shippingCity,
              billingState: input.shippingState || null,
              billingPostalCode: input.shippingPostalCode || null,
              billingCountry: DEFAULT_COUNTRY,

              notes: input.notes || null,
              items: {
                create: lines.map((line) => ({
                  productId: line.productId,
                  variantId: line.variantId,
                  productName: line.name,
                  productSku: line.sku,
                  variantInfo: line.variantLabel,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  totalPrice: line.lineTotal,
                })),
              },
            },
          });
        } catch (error) {
          if (attempt === 4 || !isUniqueViolation(error)) throw error;
        }
      }

      if (!created) throw new Error("Could not allocate an order number");

      // Gift line, if the coupon grants one. Legacy did not reserve stock for
      // gifts either — kept as-is, but the line is flagged so reporting can
      // tell it apart.
      if (giftProductId && giftProductName) {
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            productId: giftProductId,
            productName: `${giftProductName} (free gift — ${couponCode})`,
            variantInfo: "Gift item",
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            isGift: true,
          },
        });
      }

      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
      }

      if (input.courierId) {
        const courier = await tx.courier.findFirst({
          where: { id: input.courierId, storeId: DEFAULT_STORE_ID, isActive: true },
          select: { id: true, name: true },
        });
        if (courier) {
          await tx.shipment.create({
            data: {
              orderId: created.id,
              courierId: courier.id,
              courierName: courier.name,
              status: "PENDING",
              deliveryFee: shipping,
            },
          });
        }
      }

      await tx.payment.create({
        data: {
          orderId: created.id,
          gateway: input.paymentMethod,
          method: input.paymentMethod,
          amount: total,
          currency: "BDT",
          // Cash on delivery is legitimately pending until the courier collects.
          // Online methods stay pending until a real gateway confirms — this
          // app never marks an order paid without confirmation, unlike legacy,
          // which ignored the gateway result entirely.
          status: "PENDING",
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    orderNumber = order.orderNumber;
  } catch (error) {
    if (error instanceof OutOfStockError) {
      return {
        ok: false,
        message: `${error.itemName} sold out while you were checking out. Please review your bag.`,
      };
    }
    console.error("Order placement failed", error);
    return { ok: false, message: "We couldn't place your order. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect(`/order/${orderNumber}`);
}

class OutOfStockError extends Error {
  constructor(public itemName: string) {
    super(`Out of stock: ${itemName}`);
    this.name = "OutOfStockError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Reserved for the admin/POS phase, kept beside the order writer. */
export { variantLabel };
