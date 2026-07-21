"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { generatePaymentNumber, withUniqueDocNumber } from "@/lib/doc-number";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Enter a supplier name").max(255),
  code: z.string().trim().max(50).optional(),
  contactPerson: z.string().trim().max(255).optional(),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]).optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).default("Bangladesh"),
  paymentTerms: z.coerce
    .number()
    .int("Payment terms must be a whole number of days")
    .min(0, "Payment terms cannot be negative")
    .max(365, "Payment terms cannot exceed 365 days")
    .default(30),
  notes: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

/** Store-scoped lookup — never trust an id straight off the client. */
async function findSupplier(id: number) {
  if (!Number.isInteger(id)) return null;
  return prisma.supplier.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, name: true, status: true },
  });
}

export async function createSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  // Legacy generated codes from `uniqid()` and never checked them. A code is
  // optional here, but when supplied it has to be unique within the store.
  if (d.code) {
    const clash = await prisma.supplier.findFirst({
      where: { storeId: DEFAULT_STORE_ID, code: d.code },
      select: { id: true },
    });
    if (clash) {
      return { ok: false, errors: { code: ["Another supplier already uses that code"] } };
    }
  }

  const supplier = await prisma.supplier.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      code: d.code || null,
      contactPerson: d.contactPerson || null,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      city: d.city || null,
      country: d.country || "Bangladesh",
      paymentTerms: d.paymentTerms,
      notes: d.notes || null,
      status: d.status,
    },
    select: { id: true },
  });

  revalidatePath("/admin/suppliers");
  redirect(`/admin/suppliers/${supplier.id}?created=1`);
}

export async function updateSupplier(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const existing = await findSupplier(id);
  if (!existing) return { ok: false, message: "That supplier no longer exists." };

  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  if (d.code) {
    const clash = await prisma.supplier.findFirst({
      where: { storeId: DEFAULT_STORE_ID, code: d.code, id: { not: id } },
      select: { id: true },
    });
    if (clash) {
      return { ok: false, errors: { code: ["Another supplier already uses that code"] } };
    }
  }

  await prisma.supplier.update({
    where: { id },
    data: {
      name: d.name,
      code: d.code || null,
      contactPerson: d.contactPerson || null,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      city: d.city || null,
      country: d.country || "Bangladesh",
      paymentTerms: d.paymentTerms,
      notes: d.notes || null,
      status: d.status,
    },
  });

  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${id}`);
  return { ok: true, message: "Supplier saved." };
}

export async function deleteSupplier(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await findSupplier(id);
  if (!existing) return { ok: false, message: "That supplier no longer exists." };

  // The purchase-order FK is Restrict, so a delete would fail at the database.
  // Deactivate instead and say so, rather than surfacing a constraint error.
  const [orderCount, paymentCount] = await Promise.all([
    prisma.purchaseOrder.count({ where: { supplierId: id } }),
    prisma.supplierPayment.count({ where: { supplierId: id } }),
  ]);

  if (orderCount > 0 || paymentCount > 0) {
    if (existing.status === "INACTIVE") {
      return {
        ok: false,
        message:
          "This supplier has purchase history and cannot be deleted. It is already deactivated.",
      };
    }

    await prisma.supplier.update({ where: { id }, data: { status: "INACTIVE" } });
    revalidatePath("/admin/suppliers");
    revalidatePath(`/admin/suppliers/${id}`);
    return {
      ok: true,
      message:
        "This supplier has purchase history, so it was deactivated rather than deleted.",
    };
  }

  await prisma.supplier.delete({ where: { id } });
  revalidatePath("/admin/suppliers");
  return { ok: true, message: "Supplier deleted." };
}

/* -------------------------------------------------------------------------
   Payments
   ------------------------------------------------------------------------- */

const paymentSchema = z.object({
  purchaseOrderId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "" || v === null) return null;
      const n = Number(v);
      return Number.isInteger(n) ? n : null;
    }),
  amount: z.coerce.number().positive("Enter an amount above zero"),
  paymentDate: z.string().trim().min(1, "Choose a payment date"),
  paymentMethod: z
    .enum(["CASH", "BANK_TRANSFER", "CHECK", "MOBILE_BANKING", "OTHER"])
    .default("BANK_TRANSFER"),
  referenceNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().optional(),
});

/** `YYYY-MM-DD` from a date input into the UTC midnight Prisma stores for `@db.Date`. */
function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function recordSupplierPayment(
  supplierId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const supplier = await findSupplier(supplierId);
  if (!supplier) return { ok: false, message: "That supplier no longer exists." };

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const paymentDate = parseDateOnly(d.paymentDate);
  if (!paymentDate) {
    return { ok: false, errors: { paymentDate: ["Enter a valid date"] } };
  }

  const amount = round2(d.amount);

  // A linked PO has to belong to this supplier and this store.
  let purchaseOrder: { id: number; totalAmount: unknown; paidAmount: unknown } | null =
    null;

  if (d.purchaseOrderId !== null) {
    purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: {
        id: d.purchaseOrderId,
        supplierId,
        storeId: DEFAULT_STORE_ID,
        status: { not: "CANCELLED" },
      },
      select: { id: true, totalAmount: true, paidAmount: true },
    });

    if (!purchaseOrder) {
      return {
        ok: false,
        errors: { purchaseOrderId: ["That purchase order is not available for payment"] },
      };
    }
  }

  await withUniqueDocNumber(generatePaymentNumber, (paymentNumber) =>
    prisma.$transaction(async (tx) => {
      await tx.supplierPayment.create({
        data: {
          storeId: DEFAULT_STORE_ID,
          supplierId,
          purchaseOrderId: purchaseOrder?.id ?? null,
          paymentNumber,
          amount,
          paymentDate,
          paymentMethod: d.paymentMethod,
          referenceNumber: d.referenceNumber || null,
          notes: d.notes || null,
          createdById: user.id,
        },
      });

      await tx.supplier.update({
        where: { id: supplierId },
        data: { totalPaid: { increment: amount } },
      });

      if (purchaseOrder) {
        // Re-read inside the transaction so a concurrent payment cannot make
        // two writers compute the same "new paid" figure.
        const current = await tx.purchaseOrder.findUniqueOrThrow({
          where: { id: purchaseOrder.id },
          select: { totalAmount: true, paidAmount: true },
        });

        const total = round2(Number(current.totalAmount));
        const paid = round2(Number(current.paidAmount) + amount);

        // Compare in whole cents — a float `>=` misreads an exact settlement.
        const paidCents = Math.round(paid * 100);
        const totalCents = Math.round(total * 100);

        const paymentStatus =
          paidCents >= totalCents && totalCents > 0
            ? "PAID"
            : paidCents > 0
              ? "PARTIAL"
              : "PENDING";

        await tx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: { paidAmount: paid, paymentStatus },
        });
      }
    }),
  );

  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${supplierId}`);
  revalidatePath("/admin/purchase-orders");
  if (purchaseOrder) revalidatePath(`/admin/purchase-orders/${purchaseOrder.id}`);

  return { ok: true, message: "Payment recorded." };
}

export async function deleteSupplierPayment(paymentId: number): Promise<FormState> {
  await requireStaff();

  const payment = await prisma.supplierPayment.findFirst({
    where: { id: paymentId, storeId: DEFAULT_STORE_ID },
    select: { id: true, supplierId: true, purchaseOrderId: true, amount: true },
  });
  if (!payment) return { ok: false, message: "That payment no longer exists." };

  const amount = round2(Number(payment.amount));

  await prisma.$transaction(async (tx) => {
    await tx.supplierPayment.delete({ where: { id: payment.id } });

    await tx.supplier.update({
      where: { id: payment.supplierId },
      data: { totalPaid: { decrement: amount } },
    });

    if (payment.purchaseOrderId) {
      const current = await tx.purchaseOrder.findUnique({
        where: { id: payment.purchaseOrderId },
        select: { totalAmount: true, paidAmount: true },
      });

      if (current) {
        const total = round2(Number(current.totalAmount));
        const paid = Math.max(0, round2(Number(current.paidAmount) - amount));
        const paidCents = Math.round(paid * 100);
        const totalCents = Math.round(total * 100);

        const paymentStatus =
          paidCents >= totalCents && totalCents > 0
            ? "PAID"
            : paidCents > 0
              ? "PARTIAL"
              : "PENDING";

        await tx.purchaseOrder.update({
          where: { id: payment.purchaseOrderId },
          data: { paidAmount: paid, paymentStatus },
        });
      }
    }
  });

  revalidatePath("/admin/suppliers");
  revalidatePath(`/admin/suppliers/${payment.supplierId}`);
  revalidatePath("/admin/purchase-orders");
  if (payment.purchaseOrderId) {
    revalidatePath(`/admin/purchase-orders/${payment.purchaseOrderId}`);
  }

  return { ok: true, message: "Payment removed." };
}
