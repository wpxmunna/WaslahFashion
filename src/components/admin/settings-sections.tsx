"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import {
  updateContactSettings,
  updateGeneralSettings,
  updatePaymentSettings,
  updateShippingSettings,
  updateSocialSettings,
} from "@/actions/admin/settings";
import { initialFormState, type FormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { CURRENCY } from "@/lib/config";

/** A settings value bag: key → stored string. */
export type SettingsMap = Record<string, string>;

type SectionAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * One independently-submitted settings section. Each posts to its own action so
 * a validation failure in one group never discards edits in another.
 */
function SettingsSection({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action: SectionAction;
  children: (errors: Record<string, string[]>) => ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <section id={id} className="scroll-mt-24">
      <form action={formAction}>
        <Panel title={title} description={description}>
          <div className="space-y-4 p-5">
            {state.message && <FormMessage state={state} />}
            {children(state.errors ?? {})}
          </div>
          <FormActions>
            <SubmitButton>Save {title.toLowerCase()}</SubmitButton>
          </FormActions>
        </Panel>
      </form>
    </section>
  );
}

export function GeneralSettings({ values }: { values: SettingsMap }) {
  return (
    <SettingsSection
      id="general"
      title="General"
      description="How the shop identifies itself."
      action={updateGeneralSettings}
    >
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="site_name"
            label="Site name"
            required
            defaultValue={values.site_name ?? ""}
            errors={e.site_name}
          />
          <TextField
            name="site_tagline"
            label="Tagline"
            maxLength={160}
            defaultValue={values.site_tagline ?? ""}
            errors={e.site_tagline}
          />
          <TextareaField
            name="site_description"
            label="Site description"
            rows={3}
            maxLength={1000}
            defaultValue={values.site_description ?? ""}
            errors={e.site_description}
            className="sm:col-span-2"
          />
          <TextareaField
            name="meta_description"
            label="Default meta description"
            rows={2}
            maxLength={320}
            hint="Used for pages that do not set their own description."
            defaultValue={values.meta_description ?? ""}
            errors={e.meta_description}
            className="sm:col-span-2"
          />
        </div>
      )}
    </SettingsSection>
  );
}

export function ContactSettings({ values }: { values: SettingsMap }) {
  return (
    <SettingsSection
      id="contact"
      title="Contact"
      description="Shown in the footer and on the contact page."
      action={updateContactSettings}
    >
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="business_phone"
            label="Business phone"
            defaultValue={values.business_phone ?? ""}
            errors={e.business_phone}
          />
          <TextField
            name="business_email"
            label="Business email"
            type="email"
            defaultValue={values.business_email ?? ""}
            errors={e.business_email}
          />
          <TextField
            name="business_hours"
            label="Business hours"
            placeholder="Sat–Thu, 10am–8pm"
            defaultValue={values.business_hours ?? ""}
            errors={e.business_hours}
          />
          <TextareaField
            name="business_address"
            label="Business address"
            rows={3}
            defaultValue={values.business_address ?? ""}
            errors={e.business_address}
            className="sm:col-span-2"
          />
        </div>
      )}
    </SettingsSection>
  );
}

export function ShippingSettings({
  values,
  codeFallbacks,
}: {
  values: SettingsMap;
  /** The values `src/lib/config.ts` still hardcodes, shown for comparison. */
  codeFallbacks: { freeShippingThreshold: number; defaultShippingCost: number };
}) {
  return (
    <SettingsSection
      id="shipping"
      title="Shipping"
      description="Storefront delivery charges."
      action={updateShippingSettings}
    >
      {(e) => (
        <>
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            These values are saved to the database, but the storefront checkout still
            reads the constants in <code>src/lib/config.ts</code> (currently{" "}
            {codeFallbacks.freeShippingThreshold} and {codeFallbacks.defaultShippingCost}).
            A follow-up change is needed to make checkout read these settings.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="free_shipping_threshold"
              label={`Free shipping threshold (${CURRENCY.code})`}
              type="number"
              step="0.01"
              min="0"
              required
              hint="Orders at or above this subtotal ship free."
              defaultValue={
                values.free_shipping_threshold ??
                String(codeFallbacks.freeShippingThreshold)
              }
              errors={e.free_shipping_threshold}
            />
            <TextField
              name="default_shipping_cost"
              label={`Default shipping cost (${CURRENCY.code})`}
              type="number"
              step="0.01"
              min="0"
              required
              hint="Flat fee below the free-shipping threshold."
              defaultValue={
                values.default_shipping_cost ?? String(codeFallbacks.defaultShippingCost)
              }
              errors={e.default_shipping_cost}
            />
          </div>
        </>
      )}
    </SettingsSection>
  );
}

export function SocialSettings({ values }: { values: SettingsMap }) {
  return (
    <SettingsSection
      id="social"
      title="Social"
      description="Profile links used in the footer."
      action={updateSocialSettings}
    >
      {(e) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="facebook_page_url"
            label="Facebook page"
            type="url"
            placeholder="https://facebook.com/…"
            defaultValue={values.facebook_page_url ?? ""}
            errors={e.facebook_page_url}
          />
          <TextField
            name="instagram_url"
            label="Instagram"
            type="url"
            placeholder="https://instagram.com/…"
            defaultValue={values.instagram_url ?? ""}
            errors={e.instagram_url}
          />
          <TextField
            name="youtube_url"
            label="YouTube"
            type="url"
            placeholder="https://youtube.com/…"
            defaultValue={values.youtube_url ?? ""}
            errors={e.youtube_url}
          />
          <TextField
            name="tiktok_url"
            label="TikTok"
            type="url"
            placeholder="https://tiktok.com/…"
            defaultValue={values.tiktok_url ?? ""}
            errors={e.tiktok_url}
          />
          <TextField
            name="whatsapp_number"
            label="WhatsApp number"
            defaultValue={values.whatsapp_number ?? ""}
            errors={e.whatsapp_number}
          />
        </div>
      )}
    </SettingsSection>
  );
}

export function PaymentSettings({ values }: { values: SettingsMap }) {
  return (
    <SettingsSection
      id="payment"
      title="Payment"
      description="Which methods customers can pay with."
      action={updatePaymentSettings}
    >
      {(e) => (
        <>
          <div className="space-y-3">
            <CheckboxField
              name="payment_cod_enabled"
              label="Cash on delivery"
              hint="Collected by the courier on handover."
              defaultChecked={values.payment_cod_enabled !== "0"}
            />
            <CheckboxField
              name="payment_bkash_enabled"
              label="bKash"
              hint="Manual transfer to the merchant number below — there is no bKash API integration."
              defaultChecked={values.payment_bkash_enabled === "1"}
            />
            <CheckboxField
              name="payment_card_enabled"
              label="Card"
              defaultChecked={values.payment_card_enabled === "1"}
            />
          </div>
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <TextField
              name="payment_bkash_number"
              label="bKash merchant number"
              placeholder="01XXXXXXXXX"
              defaultValue={values.payment_bkash_number ?? ""}
              errors={e.payment_bkash_number}
            />
          </div>
        </>
      )}
    </SettingsSection>
  );
}
