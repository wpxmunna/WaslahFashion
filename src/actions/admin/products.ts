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

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name"),
  slug: z.string().trim().optional(),
  categoryId: optionalNumber,
  shortDescription: z.string().trim().max(500).optional(),
  description: z.string().trim().optional(),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  salePrice: optionalNumber,
  costPrice: optionalNumber,
  sku: z.string().trim().max(50).optional(),
  barcode: z.string().trim().max(50).optional(),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  weight: optionalNumber,
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).default("ACTIVE"),
  isFeatured: z.coerce.boolean().default(false),
  isNew: z.coerce.boolean().default(false),
  metaTitle: z.string().trim().max(255).optional(),
  metaDescription: z.string().trim().max(500).optional(),
  sizeChartId: optionalNumber,
});

/** Only accept a size chart that belongs to this store; otherwise unassign. */
async function resolveSizeChartId(id: number | null): Promise<number | null> {
  if (!id) return null;
  const chart = await prisma.sizeChart.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  return chart ? id : null;
}

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

/** Ensure the slug is unique within the store, suffixing -2, -3, … if needed. */
async function uniqueSlug(base: string, storeId: number, excludeId?: number) {
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const clash = await prisma.product.findFirst({
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

function readProduct(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return productSchema.safeParse({
    ...raw,
    isFeatured: parseCheckbox(formData, "isFeatured"),
    isNew: parseCheckbox(formData, "isNew"),
  });
}

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readProduct(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  if (d.salePrice !== null && d.salePrice >= d.price) {
    return { ok: false, errors: { salePrice: ["Sale price must be below the price"] } };
  }

  const slug = await uniqueSlug(slugify(d.slug || d.name), DEFAULT_STORE_ID);
  const sizeChartId = await resolveSizeChartId(d.sizeChartId);

  // A first image can be supplied inline on the create form.
  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };

  const product = await prisma.product.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      categoryId: d.categoryId,
      name: d.name,
      slug,
      shortDescription: d.shortDescription || null,
      description: d.description || null,
      price: d.price,
      salePrice: d.salePrice,
      costPrice: d.costPrice,
      sku: d.sku || null,
      barcode: d.barcode || null,
      stockQuantity: d.stockQuantity,
      lowStockThreshold: d.lowStockThreshold,
      weight: d.weight,
      status: d.status,
      isFeatured: d.isFeatured,
      isNew: d.isNew,
      metaTitle: d.metaTitle || null,
      metaDescription: d.metaDescription || null,
      sizeChartId,
      ...(image?.ok
        ? { images: { create: { path: image.path, isPrimary: true, sortOrder: 0 } } }
        : {}),
    },
    select: { id: true },
  });

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  redirect(`/admin/products/${product.id}?created=1`);
}

export async function updateProduct(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readProduct(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  if (d.salePrice !== null && d.salePrice >= d.price) {
    return { ok: false, errors: { salePrice: ["Sale price must be below the price"] } };
  }

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, slug: true },
  });
  if (!existing) return { ok: false, message: "That product no longer exists." };

  const desiredSlug = slugify(d.slug || d.name);
  const slug =
    desiredSlug === existing.slug
      ? existing.slug
      : await uniqueSlug(desiredSlug, DEFAULT_STORE_ID, id);

  await prisma.product.update({
    where: { id },
    data: {
      categoryId: d.categoryId,
      name: d.name,
      slug,
      shortDescription: d.shortDescription || null,
      description: d.description || null,
      price: d.price,
      salePrice: d.salePrice,
      costPrice: d.costPrice,
      sku: d.sku || null,
      barcode: d.barcode || null,
      stockQuantity: d.stockQuantity,
      lowStockThreshold: d.lowStockThreshold,
      weight: d.weight,
      status: d.status,
      isFeatured: d.isFeatured,
      isNew: d.isNew,
      metaTitle: d.metaTitle || null,
      metaDescription: d.metaDescription || null,
      sizeChartId: await resolveSizeChartId(d.sizeChartId),
    },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/shop");
  revalidatePath(`/product/${slug}`);

  return { ok: true, message: "Product saved." };
}

export async function deleteProduct(id: number): Promise<FormState> {
  await requireStaff();

  // Products referenced by orders are archived rather than deleted, so order
  // history keeps its link. Legacy hard-deleted and orphaned the rows.
  const orderCount = await prisma.orderItem.count({ where: { productId: id } });

  if (orderCount > 0) {
    await prisma.product.update({ where: { id }, data: { status: "INACTIVE" } });
    revalidatePath("/admin/products");
    revalidatePath("/shop");
    return {
      ok: true,
      message: "Product appears on past orders, so it was archived rather than deleted.",
    };
  }

  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true, message: "Product deleted." };
}

export async function addProductImage(
  productId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
  );
  if (!image) return { ok: false, message: "Choose a file or paste an image URL." };
  if (!image.ok) return { ok: false, message: image.error };

  const count = await prisma.productImage.count({ where: { productId } });

  await prisma.productImage.create({
    data: {
      productId,
      path: image.path,
      isPrimary: count === 0,
      sortOrder: count,
    },
  });

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/shop");
  return { ok: true, message: "Image added." };
}

export async function deleteProductImage(imageId: number): Promise<FormState> {
  await requireStaff();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { id: true, productId: true, isPrimary: true },
  });
  if (!image) return { ok: false, message: "Image not found." };

  await prisma.productImage.delete({ where: { id: imageId } });

  // Promote another image so the product never loses its primary.
  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId: image.productId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (next) {
      await prisma.productImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

  revalidatePath(`/admin/products/${image.productId}`);
  revalidatePath("/shop");
  return { ok: true, message: "Image removed." };
}

export async function setPrimaryImage(imageId: number): Promise<FormState> {
  await requireStaff();

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { id: true, productId: true },
  });
  if (!image) return { ok: false, message: "Image not found." };

  await prisma.$transaction([
    prisma.productImage.updateMany({
      where: { productId: image.productId },
      data: { isPrimary: false },
    }),
    prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);

  revalidatePath(`/admin/products/${image.productId}`);
  revalidatePath("/shop");
  return { ok: true, message: "Primary image updated." };
}

const variantSchema = z.object({
  size: z.string().trim().max(20).optional(),
  colorName: z.string().trim().max(50).optional(),
  colorHex: z.string().trim().max(7).optional(),
  sku: z.string().trim().max(50).optional(),
  priceModifier: z.coerce.number().default(0),
  stockQuantity: z.coerce.number().int().min(0).default(0),
});

export async function addProductVariant(
  productId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = variantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fieldErrors(z.flattenError(parsed.error).fieldErrors);
  }

  const d = parsed.data;
  if (!d.size && !d.colorName) {
    return { ok: false, message: "A variant needs at least a size or a colour." };
  }

  const clash = await prisma.productVariant.findFirst({
    where: {
      productId,
      size: d.size || null,
      colorName: d.colorName || null,
    },
    select: { id: true },
  });
  if (clash) return { ok: false, message: "That size and colour combination already exists." };

  await prisma.productVariant.create({
    data: {
      productId,
      size: d.size || null,
      colorName: d.colorName || null,
      colorHex: d.colorHex || null,
      sku: d.sku || null,
      priceModifier: d.priceModifier,
      stockQuantity: d.stockQuantity,
    },
  });

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Variant added." };
}

export async function updateVariantStock(
  variantId: number,
  stockQuantity: number,
): Promise<FormState> {
  await requireStaff();

  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: Math.max(0, Math.trunc(stockQuantity)) },
    select: { productId: true },
  });

  revalidatePath(`/admin/products/${variant.productId}`);
  return { ok: true, message: "Stock updated." };
}

export async function deleteProductVariant(variantId: number): Promise<FormState> {
  await requireStaff();

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, productId: true },
  });
  if (!variant) return { ok: false, message: "Variant not found." };

  const used = await prisma.orderItem.count({ where: { variantId } });
  if (used > 0) {
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: false },
    });
    revalidatePath(`/admin/products/${variant.productId}`);
    return { ok: true, message: "Variant is on past orders, so it was deactivated." };
  }

  await prisma.productVariant.delete({ where: { id: variantId } });
  revalidatePath(`/admin/products/${variant.productId}`);
  return { ok: true, message: "Variant deleted." };
}
