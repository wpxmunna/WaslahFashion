"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { resolveImageInput } from "@/lib/admin/upload";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

const courierSchema = z.object({
  name: z.string().trim().min(2, "Enter a courier name").max(100),
  code: z
    .string()
    .trim()
    .min(2, "Enter a code")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphens or underscores only"),
  description: z.string().trim().optional(),
  baseRate: z.coerce.number().min(0, "Base rate cannot be negative"),
  perKgRate: z.coerce.number().min(0, "Per-kg rate cannot be negative"),
  estimatedDays: z.string().trim().max(20).optional(),
  trackingUrl: z.string().trim().max(255).optional(),
  isActive: z.coerce.boolean().default(true),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readCourier(formData: FormData) {
  return courierSchema.safeParse({
    ...Object.fromEntries(formData),
    isActive: parseCheckbox(formData, "isActive"),
  });
}

/** Tracking URLs are rendered as links, so only http(s) is accepted. */
function invalidTrackingUrl(url: string | undefined): boolean {
  return !!url && !/^https?:\/\//i.test(url);
}

export async function createCourier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readCourier(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const code = d.code.toUpperCase();

  if (invalidTrackingUrl(d.trackingUrl)) {
    return {
      ok: false,
      errors: { trackingUrl: ["Tracking URL must start with http:// or https://"] },
    };
  }

  const clash = await prisma.courier.findFirst({
    where: { storeId: DEFAULT_STORE_ID, code },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, errors: { code: ["That code is already used by another courier"] } };
  }

  const logo = await resolveImageInput(
    formData.get("logoFile") as File | null,
    formData.get("logoUrl") as string | null,
    "couriers",
  );
  if (logo && !logo.ok) return { ok: false, errors: { logoUrl: [logo.error] } };

  const courier = await prisma.courier.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      code,
      description: d.description || null,
      logo: logo?.ok ? logo.path : null,
      baseRate: d.baseRate,
      perKgRate: d.perKgRate,
      estimatedDays: d.estimatedDays || null,
      trackingUrl: d.trackingUrl || null,
      isActive: d.isActive,
    },
    select: { id: true },
  });

  revalidatePath("/admin/couriers");
  redirect(`/admin/couriers/${courier.id}?created=1`);
}

export async function updateCourier(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readCourier(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const code = d.code.toUpperCase();

  if (invalidTrackingUrl(d.trackingUrl)) {
    return {
      ok: false,
      errors: { trackingUrl: ["Tracking URL must start with http:// or https://"] },
    };
  }

  const existing = await prisma.courier.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, logo: true },
  });
  if (!existing) return { ok: false, message: "That courier no longer exists." };

  const clash = await prisma.courier.findFirst({
    where: { storeId: DEFAULT_STORE_ID, code, id: { not: id } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, errors: { code: ["That code is already used by another courier"] } };
  }

  const logo = await resolveImageInput(
    formData.get("logoFile") as File | null,
    formData.get("logoUrl") as string | null,
    "couriers",
  );
  if (logo && !logo.ok) return { ok: false, errors: { logoUrl: [logo.error] } };

  await prisma.courier.update({
    where: { id },
    data: {
      name: d.name,
      code,
      description: d.description || null,
      ...(logo?.ok ? { logo: logo.path } : {}),
      baseRate: d.baseRate,
      perKgRate: d.perKgRate,
      estimatedDays: d.estimatedDays || null,
      trackingUrl: d.trackingUrl || null,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/couriers");
  revalidatePath(`/admin/couriers/${id}`);
  return { ok: true, message: "Courier saved." };
}

export async function deleteCourier(id: number): Promise<FormState> {
  await requireStaff();

  const courier = await prisma.courier.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!courier) return { ok: false, message: "That courier no longer exists." };

  // Shipments keep a nullable courierId; hard-deleting would silently orphan
  // the delivery history, so deactivate instead.
  const shipments = await prisma.shipment.count({ where: { courierId: id } });
  if (shipments > 0) {
    await prisma.courier.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/couriers");
    revalidatePath(`/admin/couriers/${id}`);
    return {
      ok: true,
      message: `This courier is on ${shipments} shipment${
        shipments === 1 ? "" : "s"
      }, so it was deactivated rather than deleted.`,
    };
  }

  await prisma.courier.delete({ where: { id } });
  revalidatePath("/admin/couriers");
  return { ok: true, message: "Courier deleted." };
}
