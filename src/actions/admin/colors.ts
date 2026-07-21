"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

/**
 * Accepts `#abc` or `#abcdef` (with or without the hash) and normalises to a
 * lowercase 6-digit `#rrggbb`, which is all the 7-char column can hold.
 */
const hexSchema = z
  .string()
  .trim()
  .transform((v) => (v.startsWith("#") ? v : `#${v}`))
  .refine((v) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v), {
    message: "Use a hex colour like #2B3A67",
  })
  .transform((v) => {
    const body = v.slice(1).toLowerCase();
    return body.length === 3
      ? `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`
      : `#${body}`;
  });

const colorSchema = z.object({
  name: z.string().trim().min(1, "Enter a colour name").max(50),
  hex: hexSchema,
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readColor(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return colorSchema.safeParse({
    ...raw,
    isActive: parseCheckbox(formData, "isActive"),
  });
}

/** Names are unique per store and compared case-insensitively. */
async function nameTaken(name: string, excludeId?: number): Promise<boolean> {
  const rows = await prisma.color.findMany({
    where: {
      storeId: DEFAULT_STORE_ID,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });
  const wanted = name.trim().toLowerCase();
  return rows.some((r) => r.name.trim().toLowerCase() === wanted);
}

export async function createColor(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readColor(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  if (await nameTaken(d.name)) {
    return { ok: false, errors: { name: ["A colour with that name already exists"] } };
  }

  // Legacy appended to the end of the list when no order was given; keep that.
  let sortOrder = d.sortOrder;
  if (!formData.get("sortOrder")) {
    const last = await prisma.color.findFirst({
      where: { storeId: DEFAULT_STORE_ID },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? 0) + 1;
  }

  await prisma.color.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      name: d.name,
      hex: d.hex,
      sortOrder,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/colors");
  return { ok: true, message: `“${d.name}” added.` };
}

export async function updateColor(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readColor(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const existing = await prisma.color.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That colour no longer exists." };

  if (await nameTaken(d.name, id)) {
    return { ok: false, errors: { name: ["A colour with that name already exists"] } };
  }

  await prisma.color.update({
    where: { id },
    data: {
      name: d.name,
      hex: d.hex,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/colors");
  return { ok: true, message: "Colour saved." };
}

export async function toggleColor(id: number): Promise<FormState> {
  await requireStaff();

  const color = await prisma.color.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isActive: true },
  });
  if (!color) return { ok: false, message: "That colour no longer exists." };

  await prisma.color.update({
    where: { id },
    data: { isActive: !color.isActive },
  });

  revalidatePath("/admin/colors");
  return { ok: true, message: color.isActive ? "Colour hidden." : "Colour activated." };
}

export async function deleteColor(id: number): Promise<FormState> {
  await requireStaff();

  const color = await prisma.color.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, name: true, _count: { select: { variants: true } } },
  });
  if (!color) return { ok: false, message: "That colour no longer exists." };

  // Deleting would null `ProductVariant.colorId` (onDelete: SetNull) and leave
  // variants pointing at nothing, so retire the colour instead.
  if (color._count.variants > 0) {
    await prisma.color.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/colors");
    return {
      ok: true,
      message: `“${color.name}” is used by ${color._count.variants} product variant${
        color._count.variants === 1 ? "" : "s"
      }, so it was deactivated rather than deleted.`,
    };
  }

  await prisma.color.delete({ where: { id } });

  revalidatePath("/admin/colors");
  return { ok: true, message: "Colour deleted." };
}
