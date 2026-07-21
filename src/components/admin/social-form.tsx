"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createSocialLink, updateSocialLink } from "@/actions/admin/social";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";

type IconStyle = "BRANDS" | "SOLID" | "REGULAR";

type Preset = {
  platform: string;
  name: string;
  icon: string;
  color: string;
  iconStyle: IconStyle;
};

/**
 * Autofill helper, ported from the legacy `getPlatformPresets()`. Purely a
 * convenience — the platform field is free text and nothing enforces this list.
 */
const PRESETS: Preset[] = [
  { platform: "facebook", name: "Facebook", icon: "facebook", color: "#1877F2", iconStyle: "BRANDS" },
  { platform: "instagram", name: "Instagram", icon: "instagram", color: "#E4405F", iconStyle: "BRANDS" },
  { platform: "whatsapp", name: "WhatsApp", icon: "whatsapp", color: "#25D366", iconStyle: "BRANDS" },
  { platform: "youtube", name: "YouTube", icon: "youtube", color: "#FF0000", iconStyle: "BRANDS" },
  { platform: "tiktok", name: "TikTok", icon: "tiktok", color: "#000000", iconStyle: "BRANDS" },
  { platform: "twitter", name: "X", icon: "x-twitter", color: "#000000", iconStyle: "BRANDS" },
  { platform: "pinterest", name: "Pinterest", icon: "pinterest", color: "#BD081C", iconStyle: "BRANDS" },
  { platform: "linkedin", name: "LinkedIn", icon: "linkedin", color: "#0A66C2", iconStyle: "BRANDS" },
  { platform: "telegram", name: "Telegram", icon: "telegram", color: "#26A5E4", iconStyle: "BRANDS" },
  { platform: "snapchat", name: "Snapchat", icon: "snapchat", color: "#FFFC00", iconStyle: "BRANDS" },
  { platform: "email", name: "Email", icon: "envelope", color: "#6B7280", iconStyle: "SOLID" },
  { platform: "phone", name: "Phone", icon: "phone", color: "#6B7280", iconStyle: "SOLID" },
  { platform: "website", name: "Website", icon: "globe", color: "#6B7280", iconStyle: "SOLID" },
  { platform: "custom", name: "Custom", icon: "link", color: "#6B7280", iconStyle: "SOLID" },
];

export type SocialFormValues = {
  id?: number;
  platform: string;
  name: string;
  url: string;
  icon: string;
  iconStyle: IconStyle;
  color: string;
  sortOrder: string;
  isActive: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  openNewTab: boolean;
};

export function SocialForm({ values }: { values: SocialFormValues }) {
  const isEdit = typeof values.id === "number";

  const action = isEdit
    ? updateSocialLink.bind(null, values.id as number)
    : createSocialLink;
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  // Controlled so choosing a preset can fill them in.
  const [platform, setPlatform] = useState(values.platform);
  const [name, setName] = useState(values.name);
  const [icon, setIcon] = useState(values.icon);
  const [iconStyle, setIconStyle] = useState<IconStyle>(values.iconStyle);
  const [color, setColor] = useState(values.color);

  function applyPreset(value: string) {
    const preset = PRESETS.find((p) => p.platform === value);
    setPlatform(value);
    if (!preset) return;
    setName(preset.name);
    setIcon(preset.icon);
    setIconStyle(preset.iconStyle);
    setColor(preset.color);
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Link">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="f-preset" className="text-sm font-medium">
                  Platform preset
                </label>
                <select
                  id="f-preset"
                  value={PRESETS.some((p) => p.platform === platform) ? platform : ""}
                  onChange={(ev) => applyPreset(ev.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                >
                  <option value="">Choose a preset to autofill…</option>
                  {PRESETS.map((p) => (
                    <option key={p.platform} value={p.platform}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fills the name, icon and colour below. You can still edit them.
                </p>
              </div>

              <TextField
                name="platform"
                label="Platform"
                required
                maxLength={50}
                hint="Machine key, e.g. instagram."
                value={platform}
                onChange={(ev) => setPlatform(ev.target.value)}
                errors={e.platform}
              />
              <TextField
                name="name"
                label="Display name"
                required
                maxLength={100}
                hint="Shown in the footer."
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                errors={e.name}
              />
              <TextField
                name="url"
                label="URL"
                required
                type="url"
                inputMode="url"
                maxLength={500}
                placeholder="https://instagram.com/waslah"
                defaultValue={values.url}
                errors={e.url}
                className="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Icon">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="icon"
                label="Icon name"
                required
                maxLength={100}
                hint="Font Awesome name without the prefix."
                value={icon}
                onChange={(ev) => setIcon(ev.target.value)}
                errors={e.icon}
              />
              <SelectField
                name="iconStyle"
                label="Icon style"
                value={iconStyle}
                onChange={(ev) => setIconStyle(ev.target.value as IconStyle)}
                errors={e.iconStyle}
                options={[
                  { value: "BRANDS", label: "Brands" },
                  { value: "SOLID", label: "Solid" },
                  { value: "REGULAR", label: "Regular" },
                ]}
              />
              <div className="sm:col-span-2">
                <label htmlFor="f-color" className="text-sm font-medium">
                  Brand colour
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="f-color"
                    name="color"
                    type="color"
                    value={color}
                    onChange={(ev) => setColor(ev.target.value)}
                    className="h-9 w-14 cursor-pointer rounded-md border border-border bg-background p-1"
                  />
                  <span className="text-sm tabular-nums text-muted-foreground">{color}</span>
                </div>
                {e.color?.length ? (
                  <p className="mt-1 text-xs text-destructive">{e.color[0]}</p>
                ) : null}
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Placement">
          <div className="space-y-4 p-5">
            <TextField
              name="sortOrder"
              label="Sort order"
              type="number"
              min="0"
              hint="Lower numbers show first."
              defaultValue={values.sortOrder}
              errors={e.sortOrder}
            />
            <div className="space-y-3 border-t border-border pt-4">
              <CheckboxField
                name="showInHeader"
                label="Show in header"
                defaultChecked={values.showInHeader}
              />
              <CheckboxField
                name="showInFooter"
                label="Show in footer"
                defaultChecked={values.showInFooter}
              />
              <CheckboxField
                name="openNewTab"
                label="Open in a new tab"
                defaultChecked={values.openNewTab}
              />
              <CheckboxField
                name="isActive"
                label="Active"
                hint="Inactive links are hidden everywhere."
                defaultChecked={values.isActive}
              />
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/social-media" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Add link"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
