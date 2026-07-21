"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { resolveImageInput } from "@/lib/admin/upload";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

const sliderSchema = z.object({
  title: z.string().trim().min(2, "Enter a slide title").max(255),
  subtitle: z.string().trim().max(255).optional(),
  description: z.string().trim().optional(),
  buttonText: z.string().trim().max(100).optional(),
  buttonLink: z.string().trim().max(255).optional(),
  button2Text: z.string().trim().max(100).optional(),
  button2Link: z.string().trim().max(255).optional(),
  textPosition: z.enum(["LEFT", "CENTER", "RIGHT"]).default("LEFT"),
  textColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{3,8}$/i, "Pick a colour")
    .default("#ffffff"),
  overlayOpacity: z.coerce
    .number()
    .min(0, "Opacity runs from 0 to 1")
    .max(1, "Opacity runs from 0 to 1")
    .default(0.4),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readSlider(formData: FormData) {
  return sliderSchema.safeParse({
    ...Object.fromEntries(formData),
    isActive: parseCheckbox(formData, "isActive"),
  });
}

/** A button is only meaningful with both a label and a destination. */
function buttonPairError(text?: string, link?: string) {
  if (text && !link) return "Add a link for this button";
  if (link && !text) return "Add a label for this button";
  return null;
}

export async function createSlider(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readSlider(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const b1 = buttonPairError(d.buttonText, d.buttonLink);
  if (b1) return { ok: false, errors: { buttonLink: [b1] } };
  const b2 = buttonPairError(d.button2Text, d.button2Link);
  if (b2) return { ok: false, errors: { button2Link: [b2] } };

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
    "sliders",
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };
  if (!image) {
    return { ok: false, errors: { imageUrl: ["A slide needs a background image"] } };
  }

  // Append to the end of the running order unless a position was given.
  const last = await prisma.slider.findFirst({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const slider = await prisma.slider.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      title: d.title,
      subtitle: d.subtitle || null,
      description: d.description || null,
      buttonText: d.buttonText || null,
      buttonLink: d.buttonLink || null,
      button2Text: d.button2Text || null,
      button2Link: d.button2Link || null,
      image: image.path,
      textPosition: d.textPosition,
      textColor: d.textColor,
      overlayOpacity: d.overlayOpacity,
      sortOrder: d.sortOrder || (last ? last.sortOrder + 1 : 0),
      isActive: d.isActive,
    },
    select: { id: true },
  });

  revalidatePath("/admin/sliders");
  revalidatePath("/");
  redirect(`/admin/sliders/${slider.id}?created=1`);
}

export async function updateSlider(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readSlider(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  const b1 = buttonPairError(d.buttonText, d.buttonLink);
  if (b1) return { ok: false, errors: { buttonLink: [b1] } };
  const b2 = buttonPairError(d.button2Text, d.button2Link);
  if (b2) return { ok: false, errors: { button2Link: [b2] } };

  const existing = await prisma.slider.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, image: true },
  });
  if (!existing) return { ok: false, message: "That slide no longer exists." };

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
    "sliders",
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };

  await prisma.slider.update({
    where: { id },
    data: {
      title: d.title,
      subtitle: d.subtitle || null,
      description: d.description || null,
      buttonText: d.buttonText || null,
      buttonLink: d.buttonLink || null,
      button2Text: d.button2Text || null,
      button2Link: d.button2Link || null,
      // Keep the current image when neither a file nor a URL was supplied.
      ...(image?.ok ? { image: image.path } : {}),
      textPosition: d.textPosition,
      textColor: d.textColor,
      overlayOpacity: d.overlayOpacity,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
    },
  });

  revalidatePath("/admin/sliders");
  revalidatePath(`/admin/sliders/${id}`);
  revalidatePath("/");
  return { ok: true, message: "Slide saved." };
}

export async function deleteSlider(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.slider.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That slide no longer exists." };

  await prisma.slider.delete({ where: { id } });

  revalidatePath("/admin/sliders");
  revalidatePath("/");
  return { ok: true, message: "Slide deleted." };
}

export async function toggleSliderActive(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.slider.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isActive: true },
  });
  if (!existing) return { ok: false, message: "That slide no longer exists." };

  await prisma.slider.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/admin/sliders");
  revalidatePath("/");
  return {
    ok: true,
    message: existing.isActive ? "Slide hidden." : "Slide is now live.",
  };
}

/**
 * Swap a slide with its neighbour. Swapping the two `sortOrder` values keeps
 * the sequence stable even when the stored values are sparse or duplicated,
 * which the legacy data frequently is.
 */
export async function moveSlider(id: number, direction: "up" | "down"): Promise<FormState> {
  await requireStaff();

  const current = await prisma.slider.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, sortOrder: true },
  });
  if (!current) return { ok: false, message: "That slide no longer exists." };

  const up = direction === "up";
  const neighbour = await prisma.slider.findFirst({
    where: {
      storeId: DEFAULT_STORE_ID,
      OR: [
        { sortOrder: up ? { lt: current.sortOrder } : { gt: current.sortOrder } },
        // Tie-break on id so duplicate sortOrder values still reorder.
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
      await tx.slider.update({
        where: { id: current.id },
        data: { sortOrder: up ? current.sortOrder - 1 : current.sortOrder + 1 },
      });
      return;
    }

    await tx.slider.update({
      where: { id: current.id },
      data: { sortOrder: neighbour.sortOrder },
    });
    await tx.slider.update({
      where: { id: neighbour.id },
      data: { sortOrder: current.sortOrder },
    });
  });

  revalidatePath("/admin/sliders");
  revalidatePath("/");
  return { ok: true, message: "Order updated." };
}
