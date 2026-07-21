"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { resolveImageInput } from "@/lib/admin/upload";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { fieldErrors, type FormState } from "@/actions/types";

const optionalId = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(100),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().optional(),
  parentId: optionalId,
  icon: z.string().trim().max(50).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readCategory(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return categorySchema.safeParse({
    ...raw,
    isActive: parseCheckbox(formData, "isActive"),
  });
}

/** Ensure the slug is unique within the store, suffixing -2, -3, … if needed. */
async function uniqueSlug(base: string, storeId: number, excludeId?: number) {
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const clash = await prisma.category.findFirst({
      where: {
        storeId,
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

/**
 * A category may not be its own parent, nor sit under one of its own
 * descendants — either would orphan the subtree from the root and make the
 * tree query loop forever. Walk up from the proposed parent looking for `id`.
 */
async function wouldCycle(id: number, parentId: number): Promise<boolean> {
  if (id === parentId) return true;

  let cursor: number | null = parentId;
  // The depth guard also protects against pre-existing bad data in the table.
  for (let hops = 0; cursor !== null && hops < 100; hops++) {
    if (cursor === id) return true;
    const row: { parentId: number | null } | null = await prisma.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    if (!row) return false;
    cursor = row.parentId;
  }
  return false;
}

/** Reject a parent id that is missing or belongs to another store. */
async function parentInStore(parentId: number, storeId: number): Promise<boolean> {
  const parent = await prisma.category.findFirst({
    where: { id: parentId, storeId },
    select: { id: true },
  });
  return parent !== null;
}

export async function createCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readCategory(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  if (d.parentId !== null && !(await parentInStore(d.parentId, DEFAULT_STORE_ID))) {
    return { ok: false, errors: { parentId: ["That parent category doesn't exist"] } };
  }

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
    "categories",
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };

  const slug = await uniqueSlug(slugify(d.slug || d.name), DEFAULT_STORE_ID);

  const category = await prisma.category.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      parentId: d.parentId,
      name: d.name,
      slug,
      description: d.description || null,
      image: image?.ok ? image.path : null,
      icon: d.icon || null,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    },
    select: { id: true },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  redirect(`/admin/categories/${category.id}?created=1`);
}

export async function updateCategory(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readCategory(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const existing = await prisma.category.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, slug: true, image: true },
  });
  if (!existing) return { ok: false, message: "That category no longer exists." };

  if (d.parentId !== null) {
    if (!(await parentInStore(d.parentId, DEFAULT_STORE_ID))) {
      return { ok: false, errors: { parentId: ["That parent category doesn't exist"] } };
    }
    if (await wouldCycle(id, d.parentId)) {
      return {
        ok: false,
        errors: {
          parentId: [
            d.parentId === id
              ? "A category cannot be its own parent"
              : "That category is below this one, so it cannot also be its parent",
          ],
        },
        message: "Please check the highlighted fields.",
      };
    }
  }

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
    "categories",
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };

  const desiredSlug = slugify(d.slug || d.name);
  const slug =
    desiredSlug === existing.slug
      ? existing.slug
      : await uniqueSlug(desiredSlug, DEFAULT_STORE_ID, id);

  await prisma.category.update({
    where: { id },
    data: {
      parentId: d.parentId,
      name: d.name,
      slug,
      description: d.description || null,
      // Leaving both image inputs blank keeps the current image.
      ...(image?.ok ? { image: image.path } : {}),
      icon: d.icon || null,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  revalidatePath("/shop");

  return { ok: true, message: "Category saved." };
}

export async function deleteCategory(id: number): Promise<FormState> {
  await requireStaff();

  const category = await prisma.category.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true, children: true } },
    },
  });
  if (!category) return { ok: false, message: "That category no longer exists." };

  const { products, children } = category._count;

  // The schema would silently null the FKs (onDelete: SetNull), quietly
  // orphaning products and promoting children to top level. Refuse instead.
  if (products > 0 || children > 0) {
    const parts = [
      products > 0 && `${products} product${products === 1 ? "" : "s"}`,
      children > 0 && `${children} subcategor${children === 1 ? "y" : "ies"}`,
    ].filter(Boolean);

    return {
      ok: false,
      message: `“${category.name}” still has ${parts.join(" and ")}. Move or delete ${
        parts.length > 1 ? "them" : "those"
      } first.`,
    };
  }

  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  return { ok: true, message: "Category deleted." };
}

/** Remove the category image without touching the rest of the form. */
export async function clearCategoryImage(id: number): Promise<FormState> {
  await requireStaff();

  const category = await prisma.category.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!category) return { ok: false, message: "That category no longer exists." };

  await prisma.category.update({ where: { id }, data: { image: null } });

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  return { ok: true, message: "Image removed." };
}
