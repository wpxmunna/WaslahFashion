"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/admin/guard";
import { resolveImageInput } from "@/lib/admin/upload";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

const PLATFORMS = [
  "ALL",
  "FACEBOOK",
  "INSTAGRAM",
  "WHATSAPP",
  "TELEGRAM",
  "TWITTER",
] as const;

const MESSAGE_TYPES = [
  "PROMOTION",
  "ANNOUNCEMENT",
  "GREETING",
  "OFFER",
  "EVENT",
  "CUSTOM",
] as const;

const GOAL_TYPES = ["VIEWS", "COPIES", "CLICKS", "SHARES", "ENGAGEMENTS"] as const;

const NOTE_TYPES = ["GENERAL", "PERFORMANCE", "ISSUE", "IDEA"] as const;

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .refine((value) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a full URL starting with http:// or https://");

const campaignSchema = z.object({
  title: z.string().trim().min(2, "Enter a campaign title").max(255),
  platform: z.enum(PLATFORMS).default("ALL"),
  messageType: z.enum(MESSAGE_TYPES).default("PROMOTION"),
  content: z.string().trim().min(1, "Write the message content"),
  shortContent: z.string().trim().max(500).optional(),
  hashtags: z.string().trim().max(500).optional(),
  callToAction: z.string().trim().max(255).optional(),
  ctaUrl: optionalUrl,
  scheduledAt: optionalDate,
  expiresAt: optionalDate,
  isActive: z.boolean().default(true),
  isPinned: z.boolean().default(false),
});

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

function readCampaign(formData: FormData) {
  return campaignSchema.safeParse({
    ...Object.fromEntries(formData),
    isActive: parseCheckbox(formData, "isActive"),
    isPinned: parseCheckbox(formData, "isPinned"),
  });
}

export async function createCampaign(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const parsed = readCampaign(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  // Legacy accepted an expiry before the schedule; that campaign can never run.
  if (d.scheduledAt && d.expiresAt && d.expiresAt <= d.scheduledAt) {
    return { ok: false, errors: { expiresAt: ["Expiry must be after the scheduled date"] } };
  }

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
    "campaigns",
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };

  const campaign = await prisma.campaign.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      title: d.title,
      platform: d.platform,
      messageType: d.messageType,
      content: d.content,
      shortContent: d.shortContent || null,
      hashtags: d.hashtags || null,
      callToAction: d.callToAction || null,
      ctaUrl: d.ctaUrl || null,
      imagePath: image?.ok ? image.path : null,
      scheduledAt: d.scheduledAt,
      expiresAt: d.expiresAt,
      isActive: d.isActive,
      isPinned: d.isPinned,
      createdById: user.id,
    },
    select: { id: true },
  });

  revalidatePath("/admin/social-media/campaigns");
  redirect(`/admin/social-media/campaigns/${campaign.id}?created=1`);
}

export async function updateCampaign(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const parsed = readCampaign(formData);
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;

  if (d.scheduledAt && d.expiresAt && d.expiresAt <= d.scheduledAt) {
    return { ok: false, errors: { expiresAt: ["Expiry must be after the scheduled date"] } };
  }

  const existing = await prisma.campaign.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That campaign no longer exists." };

  const image = await resolveImageInput(
    formData.get("imageFile") as File | null,
    formData.get("imageUrl") as string | null,
    "campaigns",
  );
  if (image && !image.ok) return { ok: false, errors: { imageUrl: [image.error] } };

  await prisma.campaign.update({
    where: { id },
    data: {
      title: d.title,
      platform: d.platform,
      messageType: d.messageType,
      content: d.content,
      shortContent: d.shortContent || null,
      hashtags: d.hashtags || null,
      callToAction: d.callToAction || null,
      ctaUrl: d.ctaUrl || null,
      ...(image?.ok ? { imagePath: image.path } : {}),
      scheduledAt: d.scheduledAt,
      expiresAt: d.expiresAt,
      isActive: d.isActive,
      isPinned: d.isPinned,
    },
  });

  revalidatePath("/admin/social-media/campaigns");
  revalidatePath(`/admin/social-media/campaigns/${id}`);
  return { ok: true, message: "Campaign saved." };
}

export async function deleteCampaign(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.campaign.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!existing) return { ok: false, message: "That campaign no longer exists." };

  // Events, daily stats, goals and notes all cascade from the campaign row.
  await prisma.campaign.delete({ where: { id } });

  revalidatePath("/admin/social-media/campaigns");
  revalidatePath("/admin/social-media/insights");
  return { ok: true, message: "Campaign deleted." };
}

export async function toggleCampaignActive(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.campaign.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isActive: true },
  });
  if (!existing) return { ok: false, message: "That campaign no longer exists." };

  await prisma.campaign.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/admin/social-media/campaigns");
  revalidatePath(`/admin/social-media/campaigns/${id}`);
  return {
    ok: true,
    message: existing.isActive ? "Campaign paused." : "Campaign is active.",
  };
}

export async function toggleCampaignPinned(id: number): Promise<FormState> {
  await requireStaff();

  const existing = await prisma.campaign.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, isPinned: true },
  });
  if (!existing) return { ok: false, message: "That campaign no longer exists." };

  await prisma.campaign.update({
    where: { id },
    data: { isPinned: !existing.isPinned },
  });

  revalidatePath("/admin/social-media/campaigns");
  revalidatePath(`/admin/social-media/campaigns/${id}`);
  return { ok: true, message: existing.isPinned ? "Unpinned." : "Pinned to the top." };
}

export async function duplicateCampaign(id: number): Promise<FormState> {
  await requireStaff();

  const source = await prisma.campaign.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
  });
  if (!source) return { ok: false, message: "That campaign no longer exists." };

  // A duplicate starts as a fresh draft: its own counters, unpinned, inactive
  // until someone reviews it. Legacy carried the pin state's absence only.
  await prisma.campaign.create({
    data: {
      storeId: DEFAULT_STORE_ID,
      title: `${source.title} (Copy)`,
      platform: source.platform,
      messageType: source.messageType,
      content: source.content,
      shortContent: source.shortContent,
      hashtags: source.hashtags,
      callToAction: source.callToAction,
      ctaUrl: source.ctaUrl,
      imagePath: source.imagePath,
      scheduledAt: source.scheduledAt,
      expiresAt: source.expiresAt,
      isActive: false,
      isPinned: false,
      createdById: source.createdById,
    },
    select: { id: true },
  });

  revalidatePath("/admin/social-media/campaigns");
  return { ok: true, message: "Campaign duplicated as an inactive copy." };
}

/**
 * Record that the message text was copied for posting.
 *
 * Legacy also added +1 to `total_views` here, which inflated views and
 * depressed the conversion rate. A copy is logged as a COPY event only.
 */
export async function recordCampaignCopy(id: number): Promise<FormState> {
  await requireStaff();

  const campaign = await prisma.campaign.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!campaign) return { ok: false, message: "That campaign no longer exists." };

  const today = new Date();
  const date = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  await prisma.$transaction([
    prisma.campaign.update({
      where: { id },
      data: { copyCount: { increment: 1 }, lastActivityAt: new Date() },
    }),
    prisma.campaignEvent.create({
      data: { campaignId: id, type: "COPY", source: "admin" },
    }),
    prisma.campaignDailyStat.upsert({
      where: { campaignId_date: { campaignId: id, date } },
      create: { campaignId: id, date, copies: 1 },
      update: { copies: { increment: 1 } },
    }),
  ]);

  revalidatePath("/admin/social-media/campaigns");
  revalidatePath(`/admin/social-media/campaigns/${id}`);
  revalidatePath("/admin/social-media/insights");
  return { ok: true, message: "Copied to your clipboard." };
}

/* ------------------------------------------------------------------ goals */

const goalSchema = z.object({
  type: z.enum(GOAL_TYPES),
  targetValue: z.coerce.number().int().min(1, "Set a target above zero"),
  startDate: optionalDate,
  endDate: optionalDate,
});

export async function addCampaignGoal(
  campaignId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff();

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!campaign) return { ok: false, message: "That campaign no longer exists." };

  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fieldErrors(z.flattenError(parsed.error).fieldErrors);
  }

  const d = parsed.data;
  if (d.startDate && d.endDate && d.endDate <= d.startDate) {
    return { ok: false, errors: { endDate: ["The end date must be after the start date"] } };
  }

  await prisma.campaignGoal.create({
    data: {
      campaignId,
      type: d.type,
      targetValue: d.targetValue,
      startDate: d.startDate,
      endDate: d.endDate,
    },
  });

  revalidatePath(`/admin/social-media/campaigns/${campaignId}`);
  return { ok: true, message: "Goal added." };
}

export async function deleteCampaignGoal(goalId: number): Promise<FormState> {
  await requireStaff();

  // Scope through the campaign so an id from the client cannot reach another store.
  const goal = await prisma.campaignGoal.findFirst({
    where: { id: goalId, campaign: { storeId: DEFAULT_STORE_ID } },
    select: { id: true, campaignId: true },
  });
  if (!goal) return { ok: false, message: "That goal no longer exists." };

  await prisma.campaignGoal.delete({ where: { id: goalId } });

  revalidatePath(`/admin/social-media/campaigns/${goal.campaignId}`);
  return { ok: true, message: "Goal removed." };
}

/* ------------------------------------------------------------------ notes */

const noteSchema = z.object({
  note: z.string().trim().min(1, "Write a note").max(5000),
  type: z.enum(NOTE_TYPES).default("GENERAL"),
});

export async function addCampaignNote(
  campaignId: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, storeId: DEFAULT_STORE_ID },
    select: { id: true },
  });
  if (!campaign) return { ok: false, message: "That campaign no longer exists." };

  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fieldErrors(z.flattenError(parsed.error).fieldErrors);
  }

  await prisma.campaignNote.create({
    data: {
      campaignId,
      userId: user.id,
      note: parsed.data.note,
      type: parsed.data.type,
    },
  });

  revalidatePath(`/admin/social-media/campaigns/${campaignId}`);
  return { ok: true, message: "Note added." };
}

export async function deleteCampaignNote(noteId: number): Promise<FormState> {
  await requireStaff();

  const note = await prisma.campaignNote.findFirst({
    where: { id: noteId, campaign: { storeId: DEFAULT_STORE_ID } },
    select: { id: true, campaignId: true },
  });
  if (!note) return { ok: false, message: "That note no longer exists." };

  await prisma.campaignNote.delete({ where: { id: noteId } });

  revalidatePath(`/admin/social-media/campaigns/${note.campaignId}`);
  return { ok: true, message: "Note deleted." };
}
