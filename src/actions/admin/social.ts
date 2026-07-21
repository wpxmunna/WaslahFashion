"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

const socialSchema = z.object({
  platform: z.string().trim().min(2, "Choose a platform").max(50),
  name: z.string().trim().min(1, "Enter a display name").max(100),
  url: z
    .string()
    .trim()
    .min(1, "Enter a URL")
    .max(500)
    .refine((value) => {
      // `new URL` accepts mailto:, javascript: and friends — restrict to web links.
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter a full URL starting with http:// or https://"),
  icon: z.string().trim().min(1, "Enter an icon name").max(100),
  iconStyle: z.enum(["BRANDS", "SOLID", "REGULAR"]).default("BRANDS"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{3,8}$/i, "Pick a colour")
    .default("#000000"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  showInHeader: z.boolean().default(false),
  showInFooter: z.boolean().default(true),
  openNewTab: z.boolean().default(true),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readSocial(formData: FormData) {
  return socialSchema.safeParse({
    ...Object.fromEntries(formData),
    isActive: parseCheckbox(formData, "isActive"),
    showInHeader: parseCheckbox(formData, "showInHeader"),
    showInFooter: parseCheckbox(formData, "showInFooter"),
    openNewTab: parseCheckbox(formData, "openNewTab"),
  });
}

export async function createSocialLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readSocial(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  if (!d.showInHeader && !d.showInFooter) {
    return {
      ok: false,
      message: "Show the link in the header, the footer, or both — otherwise nobody sees it.",
    };
  }

  const last = await prisma.socialLink.findFirst({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const link = await prisma.socialLink.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      platform: d.platform,
      name: d.name,
      url: d.url,
      icon: d.icon,
      iconStyle: d.iconStyle,
      color: d.color,
      sortOrder: d.sortOrder || (last ? last.sortOrder + 1 : 0),
      isActive: d.isActive,
      showInHeader: d.showInHeader,
      showInFooter: d.showInFooter,
      openNewTab: d.openNewTab,
    },
    select: { id: true },
  });

  revalidatePath("/admin/social-media");
  revalidatePath("/");
  redirect(`/admin/social-media/${link.id}?created=1`);
}

export async function updateSocialLink(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readSocial(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  if (!d.showInHeader && !d.showInFooter) {
    return {
      ok: false,
      message: "Show the link in the header, the footer, or both — otherwise nobody sees it.",
    };
  }

  const existing = await prisma.socialLink.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That link no longer exists." };

  await prisma.socialLink.update({
    where: { id },
    data: {
      platform: d.platform,
      name: d.name,
      url: d.url,
      icon: d.icon,
      iconStyle: d.iconStyle,
      color: d.color,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      showInHeader: d.showInHeader,
      showInFooter: d.showInFooter,
      openNewTab: d.openNewTab,
    },
  });

  revalidatePath("/admin/social-media");
  revalidatePath(`/admin/social-media/${id}`);
  revalidatePath("/");
  return { ok: true, message: "Link saved." };
}

export async function deleteSocialLink(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.socialLink.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That link no longer exists." };

  await prisma.socialLink.delete({ where: { id } });

  revalidatePath("/admin/social-media");
  revalidatePath("/");
  return { ok: true, message: "Link deleted." };
}

export async function toggleSocialLinkActive(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.socialLink.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isActive: true },
  });
  if (!existing) return { ok: false, message: "That link no longer exists." };

  await prisma.socialLink.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/admin/social-media");
  revalidatePath("/");
  return {
    ok: true,
    message: existing.isActive ? "Link hidden." : "Link is now live.",
  };
}

export async function moveSocialLink(
  id: number,
  direction: "up" | "down",
): Promise<FormState> {
  await requireStaff();

  const current = await prisma.socialLink.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, sortOrder: true },
  });
  if (!current) return { ok: false, message: "That link no longer exists." };

  const up = direction === "up";
  const neighbour = await prisma.socialLink.findFirst({
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
      await tx.socialLink.update({
        where: { id: current.id },
        data: { sortOrder: up ? current.sortOrder - 1 : current.sortOrder + 1 },
      });
      return;
    }

    await tx.socialLink.update({
      where: { id: current.id },
      data: { sortOrder: neighbour.sortOrder },
    });
    await tx.socialLink.update({
      where: { id: neighbour.id },
      data: { sortOrder: current.sortOrder },
    });
  });

  revalidatePath("/admin/social-media");
  revalidatePath("/");
  return { ok: true, message: "Order updated." };
}
