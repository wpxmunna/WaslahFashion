"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { resolveImageInput } from "@/lib/admin/upload";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

const lookbookSchema = z.object({
  link: z.string().trim().max(255).optional(),
  caption: z.string().trim().max(255).optional(),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readLookbook(formData: FormData) {
  return lookbookSchema.safeParse({
    ...Object.fromEntries(formData),
    isFeatured: parseCheckbox(formData, "isFeatured"),
    isActive: parseCheckbox(formData, "isActive"),
  });
}

export async function createLookbookItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readLookbook(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
    "lookbook",
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };
  if (!image) {
    return { ok: false, errors: { imageUrl: ["A lookbook item needs an image"] } };
  }

  const last = await prisma.lookbookItem.findFirst({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const item = await prisma.$transaction(async (tx) => {
    // Exactly one item per store may be featured.
    if (d.isFeatured) {
      await tx.lookbookItem.updateMany({
        where: { storeId: DEFAULT_STORE_ID, isFeatured: true },
        data: { isFeatured: false },
      });
    }

    return tx.lookbookItem.create({
      data: {
        storeId: DEFAULT_STORE_ID,
        image: image.path,
        link: d.link || null,
        caption: d.caption || null,
        isFeatured: d.isFeatured,
        sortOrder: d.sortOrder || (last ? last.sortOrder + 1 : 0),
        isActive: d.isActive,
      },
      select: { id: true },
    });
  });

  revalidatePath("/admin/lookbook");
  revalidatePath("/");
  redirect(`/admin/lookbook/${item.id}?created=1`);
}

export async function updateLookbookItem(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readLookbook(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const existing = await prisma.lookbookItem.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That lookbook item no longer exists." };

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
    "lookbook",
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };

  await prisma.$transaction(async (tx) => {
    if (d.isFeatured) {
      await tx.lookbookItem.updateMany({
        where: { storeId: DEFAULT_STORE_ID, isFeatured: true, id: { not: id } },
        data: { isFeatured: false },
      });
    }

    await tx.lookbookItem.update({
      where: { id },
      data: {
        ...(image?.ok ? { image: image.path } : {}),
        link: d.link || null,
        caption: d.caption || null,
        isFeatured: d.isFeatured,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
      },
    });
  });

  revalidatePath("/admin/lookbook");
  revalidatePath(`/admin/lookbook/${id}`);
  revalidatePath("/");
  return { ok: true, message: "Lookbook item saved." };
}

export async function deleteLookbookItem(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.lookbookItem.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That lookbook item no longer exists." };

  await prisma.lookbookItem.delete({ where: { id } });

  revalidatePath("/admin/lookbook");
  revalidatePath("/");
  return { ok: true, message: "Lookbook item deleted." };
}

export async function toggleLookbookActive(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.lookbookItem.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isActive: true },
  });
  if (!existing) return { ok: false, message: "That lookbook item no longer exists." };

  await prisma.lookbookItem.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/admin/lookbook");
  revalidatePath("/");
  return {
    ok: true,
    message: existing.isActive ? "Item hidden." : "Item is now live.",
  };
}

/** Feature one item and clear the rest, atomically. */
export async function featureLookbookItem(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.lookbookItem.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isFeatured: true },
  });
  if (!existing) return { ok: false, message: "That lookbook item no longer exists." };

  if (existing.isFeatured) {
    await prisma.lookbookItem.update({ where: { id }, data: { isFeatured: false } });
    revalidatePath("/admin/lookbook");
    revalidatePath("/");
    return { ok: true, message: "No item is featured now." };
  }

  await prisma.$transaction([
    prisma.lookbookItem.updateMany({
      where: { storeId: DEFAULT_STORE_ID, isFeatured: true },
      data: { isFeatured: false },
    }),
    prisma.lookbookItem.update({ where: { id }, data: { isFeatured: true } }),
  ]);

  revalidatePath("/admin/lookbook");
  revalidatePath("/");
  return { ok: true, message: "Featured item updated." };
}

export async function moveLookbookItem(
  id: number,
  direction: "up" | "down",
): Promise<FormState> {
  await requireStaff();

  const current = await prisma.lookbookItem.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, sortOrder: true },
  });
  if (!current) return { ok: false, message: "That lookbook item no longer exists." };

  const up = direction === "up";
  const neighbour = await prisma.lookbookItem.findFirst({
    where: {
      storeId: DEFAULT_STORE_ID,
      OR: [
        { sortOrder: up ? { lt: current.sortOrder } : { gt: current.sortOrder } },
        { sortOrder: current.sortOrder, id: up ? { lt: id } : { gt: id } },
      ],
    },
    orderBy: up
      ? [{ sortOrder: "desc" }, { id: "desc" }]
      : [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, sortOrder: true },
  });

  if (!neighbour) {
    return { ok: false, message: `Already at the ${up ? "top" : "bottom"}.` };
  }

  await prisma.$transaction(async (tx) => {
    if (current.sortOrder === neighbour.sortOrder) {
      // Equal values carry no ordering information — nudge one past the other.
      await tx.lookbookItem.update({
        where: { id: current.id },
        data: { sortOrder: up ? current.sortOrder - 1 : current.sortOrder + 1 },
      });
      return;
    }

    await tx.lookbookItem.update({
      where: { id: current.id },
      data: { sortOrder: neighbour.sortOrder },
    });
    await tx.lookbookItem.update({
      where: { id: neighbour.id },
      data: { sortOrder: current.sortOrder },
    });
  });

  revalidatePath("/admin/lookbook");
  revalidatePath("/");
  return { ok: true, message: "Order updated." };
}
