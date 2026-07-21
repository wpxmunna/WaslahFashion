"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { fieldErrors, type FormState } from "@/actions/types";

/**
 * Settings live in the `Setting` EAV table keyed by (storeId, key). The legacy
 * `updateBusiness()` mass-assigned the whole POST body into settings rows; every
 * writer here uses an explicit allowlist instead.
 *
 * Currency is deliberately absent — it is fixed to BDT in `src/lib/config.ts`
 * after the legacy mojibake migration, and must not become editable again.
 */

type SettingWrite = { key: string; value: string };

async function writeSettings(group: string, entries: SettingWrite[]): Promise<void> {
  await prisma.$transaction(
    entries.map((entry) =>
      prisma.setting.upsert({
        where: { storeId_key: { storeId: DEFAULT_STORE_ID, key: entry.key } },
        create: {
          storeId: DEFAULT_STORE_ID,
          key: entry.key,
          value: entry.value,
          group,
        },
        // Never rewrite `group` on update: a key seeded into another group keeps it.
        update: { value: entry.value },
      }),
    ),
  );
}

function done(message: string): FormState {
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true, message };
}

function invalid(error: z.ZodError): FormState {
  return {
    ...fieldErrors(z.flattenError(error).fieldErrors),
    message: "Please check the highlighted fields.",
  };
}

function checkbox(formData: FormData, name: string): string {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1" ? "1" : "0";
}

/* ---------------------------------------------------------------- general */

const generalSchema = z.object({
  site_name: z.string().trim().min(1, "Enter a site name").max(100),
  site_tagline: z.string().trim().max(160).optional(),
  site_description: z.string().trim().max(1000).optional(),
  meta_description: z.string().trim().max(320).optional(),
});

export async function updateGeneralSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = generalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const d = parsed.data;
  await writeSettings("general", [
    { key: "site_name", value: d.site_name },
    { key: "site_tagline", value: d.site_tagline ?? "" },
    { key: "site_description", value: d.site_description ?? "" },
    { key: "meta_description", value: d.meta_description ?? "" },
  ]);

  return done("General settings saved.");
}

/* ---------------------------------------------------------------- contact */

const contactSchema = z.object({
  business_phone: z.string().trim().max(30).optional(),
  business_email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  business_address: z.string().trim().max(500).optional(),
  business_hours: z.string().trim().max(255).optional(),
});

export async function updateContactSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const d = parsed.data;
  await writeSettings("contact", [
    { key: "business_phone", value: d.business_phone ?? "" },
    { key: "business_email", value: d.business_email ?? "" },
    { key: "business_address", value: d.business_address ?? "" },
    { key: "business_hours", value: d.business_hours ?? "" },
  ]);

  return done("Contact details saved.");
}

/* --------------------------------------------------------------- shipping */

const shippingSchema = z.object({
  free_shipping_threshold: z.coerce
    .number()
    .min(0, "Threshold cannot be negative")
    .max(1_000_000, "That threshold looks wrong"),
  default_shipping_cost: z.coerce
    .number()
    .min(0, "Shipping cost cannot be negative")
    .max(1_000_000, "That shipping cost looks wrong"),
});

export async function updateShippingSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = shippingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const d = parsed.data;
  await writeSettings("shipping", [
    { key: "free_shipping_threshold", value: d.free_shipping_threshold.toFixed(2) },
    { key: "default_shipping_cost", value: d.default_shipping_cost.toFixed(2) },
  ]);

  return done(
    "Shipping settings saved. Note the storefront still reads the hardcoded values in src/lib/config.ts.",
  );
}

/* ----------------------------------------------------------------- social */

const urlField = z
  .union([z.literal(""), z.url("Enter a full URL starting with https://")])
  .optional();

const socialSchema = z.object({
  facebook_page_url: urlField,
  instagram_url: urlField,
  youtube_url: urlField,
  tiktok_url: urlField,
  whatsapp_number: z.string().trim().max(30).optional(),
});

export async function updateSocialSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = socialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const d = parsed.data;
  await writeSettings("social", [
    { key: "facebook_page_url", value: d.facebook_page_url ?? "" },
    { key: "instagram_url", value: d.instagram_url ?? "" },
    { key: "youtube_url", value: d.youtube_url ?? "" },
    { key: "tiktok_url", value: d.tiktok_url ?? "" },
    { key: "whatsapp_number", value: d.whatsapp_number ?? "" },
  ]);

  return done("Social links saved.");
}

/* ---------------------------------------------------------------- payment */

const paymentSchema = z.object({
  payment_bkash_number: z.string().trim().max(30).optional(),
});

export async function updatePaymentSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const cod = checkbox(formData, "payment_cod_enabled");
  const bkash = checkbox(formData, "payment_bkash_enabled");
  const card = checkbox(formData, "payment_card_enabled");

  if (cod === "0" && bkash === "0" && card === "0") {
    return {
      ok: false,
      message: "Enable at least one payment method, or customers cannot check out.",
    };
  }

  const bkashNumber = parsed.data.payment_bkash_number ?? "";
  if (bkash === "1" && !bkashNumber) {
    return {
      ok: false,
      errors: {
        payment_bkash_number: ["Enter the bKash merchant number before enabling bKash"],
      },
    };
  }

  await writeSettings("payment", [
    { key: "payment_cod_enabled", value: cod },
    { key: "payment_bkash_enabled", value: bkash },
    { key: "payment_card_enabled", value: card },
    { key: "payment_bkash_number", value: bkashNumber },
  ]);

  return done("Payment settings saved.");
}
