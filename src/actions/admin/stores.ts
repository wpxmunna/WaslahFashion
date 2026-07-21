"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { resolveImageInput } from "@/lib/admin/upload";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { fieldErrors, type FormState } from "@/actions/types";

const storeSchema = z.object({
  name: z.string().trim().min(2, "Enter a store name").max(100),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().optional(),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().optional(),
  taxRate: z.coerce
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%"),
  isActive: z.coerce.boolean().default(true),
  isDefault: z.coerce.boolean().default(false),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readStore(formData: FormData) {
  return storeSchema.safeParse({
    ...Object.fromEntries(formData),
    isActive: parseCheckbox(formData, "isActive"),
    isDefault: parseCheckbox(formData, "isDefault"),
  });
}

export async function createStore(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = readStore(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const slug = slugify(d.slug || d.name);

  // `slug` is globally unique on Store, so reject rather than auto-suffix — a
  // store URL is operator-chosen and a silent rename would be surprising.
  const clash = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (clash) {
    return { ok: false, errors: { slug: [`The slug "${slug}" is already taken`] } };
  }

  const logo = await resolveImageInput(
    formData.get("logoFile") as File | null,
    formData.get("logoUrl") as string | null,
    "stores",
  );
  if (logo && !logo.ok) return { ok: false, errors: { logoUrl: [logo.error] } };

  const store = await prisma.$transaction(async (tx) => {
    if (d.isDefault) {
      await tx.store.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.store.create({
      data: {
        name: d.name,
        slug,
        description: d.description || null,
        logo: logo?.ok ? logo.path : null,
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        taxRate: d.taxRate,
        isActive: d.isActive,
        isDefault: d.isDefault,
      },
      select: { id: true },
    });
  });

  revalidatePath("/admin/stores");
  redirect(`/admin/stores/${store.id}?created=1`);
}

export async function updateStore(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = readStore(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const existing = await prisma.store.findUnique({
    where: { id },
    select: { id: true, slug: true, isDefault: true },
  });
  if (!existing) return { ok: false, message: "That store no longer exists." };

  const slug = slugify(d.slug || d.name);
  if (slug !== existing.slug) {
    const clash = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (clash) {
      return { ok: false, errors: { slug: [`The slug "${slug}" is already taken`] } };
    }
  }

  // The default store is what the storefront falls back to; it must never be
  // both un-defaulted and inactive-only, so keep at least one default.
  const isDefault = existing.isDefault ? true : d.isDefault;
  if (existing.isDefault && !d.isDefault) {
    return {
      ok: false,
      message:
        "This is the default store. Make another store the default instead of clearing the flag here.",
    };
  }
  if (isDefault && !d.isActive) {
    return { ok: false, message: "The default store cannot be deactivated." };
  }

  const logo = await resolveImageInput(
    formData.get("logoFile") as File | null,
    formData.get("logoUrl") as string | null,
    "stores",
  );
  if (logo && !logo.ok) return { ok: false, errors: { logoUrl: [logo.error] } };

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.store.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    await tx.store.update({
      where: { id },
      data: {
        name: d.name,
        slug,
        description: d.description || null,
        ...(logo?.ok ? { logo: logo.path } : {}),
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        taxRate: d.taxRate,
        isActive: d.isActive,
        isDefault,
      },
    });
  });

  revalidatePath("/admin/stores");
  revalidatePath(`/admin/stores/${id}`);
  return { ok: true, message: "Store saved." };
}

/** Promote a store to default, clearing the flag everywhere else atomically. */
export async function setDefaultStore(id: number): Promise<FormState> {
  await requireAdmin();

  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, name: true, isActive: true },
  });
  if (!store) return { ok: false, message: "That store no longer exists." };
  if (!store.isActive) {
    return { ok: false, message: "Activate the store before making it the default." };
  }

  await prisma.$transaction([
    prisma.store.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    }),
    prisma.store.update({ where: { id }, data: { isDefault: true } }),
  ]);

  revalidatePath("/admin/stores");
  revalidatePath(`/admin/stores/${id}`);
  return { ok: true, message: `${store.name} is now the default store.` };
}

export async function deleteStore(id: number): Promise<FormState> {
  await requireAdmin();

  const store = await prisma.store.findUnique({
    where: { id },
    select: { id: true, isDefault: true },
  });
  if (!store) return { ok: false, message: "That store no longer exists." };
  if (store.isDefault) {
    return {
      ok: false,
      message: "This is the default store. Promote another store to default first.",
    };
  }

  const [products, orders] = await Promise.all([
    prisma.product.count({ where: { storeId: id } }),
    prisma.order.count({ where: { storeId: id } }),
  ]);

  if (products > 0 || orders > 0) {
    return {
      ok: false,
      message: `Cannot delete: this store still has ${products} product${
        products === 1 ? "" : "s"
      } and ${orders} order${
        orders === 1 ? "" : "s"
      }. Move or remove them first, or deactivate the store instead.`,
    };
  }

  await prisma.store.delete({ where: { id } });
  revalidatePath("/admin/stores");
  return { ok: true, message: "Store deleted." };
}
