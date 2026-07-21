"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createSlider, updateSlider } from "@/actions/admin/sliders";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SliderFormValues = {
  id?: number;
  title: string;
  subtitle: string;
  description: string;
  buttonText: string;
  buttonLink: string;
  button2Text: string;
  button2Link: string;
  /** Resolved display URL of the saved image, if any. */
  imageUrl: string | null;
  textPosition: "LEFT" | "CENTER" | "RIGHT";
  textColor: string;
  overlayOpacity: string;
  sortOrder: string;
  isActive: boolean;
};

export function SliderForm({ values }: { values: SliderFormValues }) {
  const isEdit = typeof values.id === "number";

  const action = isEdit ? updateSlider.bind(null, values.id as number) : createSlider;
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  // Mirrored locally so the preview can react as the fields are typed.
  const [title, setTitle] = useState(values.title);
  const [subtitle, setSubtitle] = useState(values.subtitle);
  const [description, setDescription] = useState(values.description);
  const [buttonText, setButtonText] = useState(values.buttonText);
  const [button2Text, setButton2Text] = useState(values.button2Text);
  const [textPosition, setTextPosition] = useState(values.textPosition);
  const [textColor, setTextColor] = useState(values.textColor);
  const [overlayOpacity, setOverlayOpacity] = useState(values.overlayOpacity);
  const [previewImage, setPreviewImage] = useState<string | null>(values.imageUrl);

  const opacity = Math.min(1, Math.max(0, Number(overlayOpacity) || 0));

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title="Preview" description="Roughly how the slide reads on the homepage.">
            <div className="p-5">
              <div
                className="relative aspect-[21/9] w-full overflow-hidden rounded-md bg-neutral-900"
                // The storefront uses a directional scrim; mirror it here.
                style={
                  previewImage
                    ? {
                        backgroundImage: `url(${previewImage})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(${
                      textPosition === "RIGHT" ? "270deg" : "90deg"
                    }, rgba(12,10,8,${opacity + 0.25}) 0%, rgba(12,10,8,${opacity}) 45%, rgba(12,10,8,0.15) 100%)`,
                  }}
                />
                <div className="relative flex h-full items-center px-6 sm:px-10">
                  <div
                    className={cn(
                      "max-w-sm",
                      textPosition === "CENTER" && "mx-auto text-center",
                      textPosition === "RIGHT" && "ml-auto text-right",
                    )}
                    style={{ color: textColor }}
                  >
                    {subtitle && (
                      <p className="text-[0.65rem] uppercase tracking-[0.2em]">{subtitle}</p>
                    )}
                    <p className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
                      {title || "Slide title"}
                    </p>
                    {description && (
                      <p className="mt-2 line-clamp-2 text-xs opacity-90">{description}</p>
                    )}
                    {(buttonText || button2Text) && (
                      <div
                        className={cn(
                          "mt-4 flex flex-wrap gap-2",
                          textPosition === "CENTER" && "justify-center",
                          textPosition === "RIGHT" && "justify-end",
                        )}
                      >
                        {buttonText && (
                          <span className="bg-white px-4 py-2 text-[0.65rem] uppercase tracking-[0.15em] text-neutral-900">
                            {buttonText}
                          </span>
                        )}
                        {button2Text && (
                          <span className="border border-current px-4 py-2 text-[0.65rem] uppercase tracking-[0.15em]">
                            {button2Text}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Content">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="title"
                label="Title"
                required
                maxLength={255}
                defaultValue={values.title}
                onChange={(ev) => setTitle(ev.target.value)}
                errors={e.title}
                className="sm:col-span-2"
              />
              <TextField
                name="subtitle"
                label="Subtitle"
                hint="Small line above the title."
                maxLength={255}
                defaultValue={values.subtitle}
                onChange={(ev) => setSubtitle(ev.target.value)}
                errors={e.subtitle}
                className="sm:col-span-2"
              />
              <TextareaField
                name="description"
                label="Description"
                rows={3}
                defaultValue={values.description}
                onChange={(ev) => setDescription(ev.target.value)}
                errors={e.description}
                className="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Buttons" description="A button needs both a label and a link.">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="buttonText"
                label="Primary button label"
                maxLength={100}
                defaultValue={values.buttonText}
                onChange={(ev) => setButtonText(ev.target.value)}
                errors={e.buttonText}
              />
              <TextField
                name="buttonLink"
                label="Primary button link"
                placeholder="/shop"
                maxLength={255}
                defaultValue={values.buttonLink}
                errors={e.buttonLink}
              />
              <TextField
                name="button2Text"
                label="Secondary button label"
                maxLength={100}
                defaultValue={values.button2Text}
                onChange={(ev) => setButton2Text(ev.target.value)}
                errors={e.button2Text}
              />
              <TextField
                name="button2Link"
                label="Secondary button link"
                placeholder="/lookbook"
                maxLength={255}
                defaultValue={values.button2Link}
                errors={e.button2Link}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Background image"
            description={isEdit ? "Leave both blank to keep the current image." : undefined}
          >
            <div className="space-y-4 p-5">
              <TextField
                name="imageUrl"
                label="Image URL"
                placeholder="https://…"
                defaultValue=""
                onChange={(ev) => setPreviewImage(ev.target.value || values.imageUrl)}
                errors={e.imageUrl}
              />
              <div>
                <label htmlFor="f-imageFile" className="text-sm font-medium">
                  …or upload a file
                </label>
                <input
                  id="f-imageFile"
                  name="imageFile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    if (file) setPreviewImage(URL.createObjectURL(file));
                  }}
                  className="mt-1.5 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                />
              </div>
            </div>
          </Panel>

          <Panel title="Appearance">
            <div className="space-y-4 p-5">
              <SelectField
                name="textPosition"
                label="Text position"
                defaultValue={values.textPosition}
                onChange={(ev) =>
                  setTextPosition(ev.target.value as SliderFormValues["textPosition"])
                }
                errors={e.textPosition}
                options={[
                  { value: "LEFT", label: "Left" },
                  { value: "CENTER", label: "Centre" },
                  { value: "RIGHT", label: "Right" },
                ]}
              />

              <div>
                <label htmlFor="f-textColor" className="text-sm font-medium">
                  Text colour
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="f-textColor"
                    name="textColor"
                    type="color"
                    value={textColor}
                    onChange={(ev) => setTextColor(ev.target.value)}
                    className="h-9 w-14 cursor-pointer rounded-md border border-border bg-background p-1"
                  />
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {textColor}
                  </span>
                </div>
                {e.textColor?.length ? (
                  <p className="mt-1 text-xs text-destructive">{e.textColor[0]}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="f-overlayOpacity" className="text-sm font-medium">
                  Overlay opacity
                </label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    id="f-overlayOpacity"
                    name="overlayOpacity"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={overlayOpacity}
                    onChange={(ev) => setOverlayOpacity(ev.target.value)}
                    className="h-2 flex-1 accent-[var(--primary)]"
                  />
                  <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                    {opacity.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Darkens the photograph so the text stays legible.
                </p>
                {e.overlayOpacity?.length ? (
                  <p className="mt-1 text-xs text-destructive">{e.overlayOpacity[0]}</p>
                ) : null}
              </div>
            </div>
          </Panel>

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
              <CheckboxField
                name="isActive"
                label="Active"
                hint="Inactive slides are hidden from the homepage."
                defaultChecked={values.isActive}
              />
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/sliders" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create slide"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
