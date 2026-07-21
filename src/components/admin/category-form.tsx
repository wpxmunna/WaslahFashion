"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  clearCategoryImage,
  createCategory,
  updateCategory,
} from "@/actions/admin/categories";
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
import { SafeImage } from "@/components/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { slugify } from "@/lib/slug";

export type CategoryFormValues = {
  id?: number;
  name: string;
  slug: string;
  description: string;
  parentId: number | null;
  icon: string;
  sortOrder: string;
  isActive: boolean;
  /** Resolved URL of the stored image, for the preview. */
  imageUrl: string | null;
};

export function CategoryForm({
  values,
  parents,
}: {
  values: CategoryFormValues;
  /** Eligible parents — the server has already removed self and descendants. */
  parents: { id: number; name: string }[];
}) {
  const isEdit = typeof values.id === "number";

  const action = isEdit
    ? updateCategory.bind(null, values.id as number)
    : createCategory;

  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  // Mirror the name into the slug until the admin types their own, so the
  // common case needs no thought and a deliberate slug is never overwritten.
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(values.slug !== "");

  const [imageUrl, setImageUrl] = useState(values.imageUrl);
  const [clearing, startClearing] = useTransition();

  function removeImage() {
    if (!values.id) return;
    startClearing(async () => {
      const r = await clearCategoryImage(values.id as number);
      if (r.ok) {
        setImageUrl(null);
        toast.success(r.message ?? "Image removed");
      } else {
        toast.error(r.message ?? "Could not remove the image");
      }
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Details">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="name"
                label="Name"
                required
                maxLength={100}
                defaultValue={values.name}
                errors={e.name}
                className="sm:col-span-2"
                onChange={(ev) => {
                  if (!slugTouched) setSlug(slugify(ev.target.value));
                }}
              />
              <TextField
                name="slug"
                label="URL slug"
                hint="Generated from the name. Edit it to set your own."
                maxLength={100}
                value={slug}
                errors={e.slug}
                className="sm:col-span-2"
                onChange={(ev) => {
                  setSlugTouched(true);
                  setSlug(ev.target.value);
                }}
              />
              <TextareaField
                name="description"
                label="Description"
                rows={5}
                defaultValue={values.description}
                errors={e.description}
                className="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Image" description="Shown on the category tiles in the shop.">
            <div className="space-y-4 p-5">
              {imageUrl && (
                <div className="flex items-center gap-4">
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                    <SafeImage
                      src={imageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                      fallbackLabel={values.name}
                    />
                  </span>
                  <button
                    type="button"
                    onClick={removeImage}
                    disabled={clearing}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.8} />
                    Remove image
                  </button>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  name="imageUrl"
                  label="Image URL"
                  placeholder="https://…"
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
                    className="mt-1.5 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                  />
                  {isEdit && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Leave both blank to keep the current image.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Placement">
            <div className="space-y-4 p-5">
              <SelectField
                name="parentId"
                label="Parent category"
                placeholder="None — top level"
                defaultValue={values.parentId ?? ""}
                errors={e.parentId}
                hint={
                  isEdit
                    ? "Categories below this one are not listed here."
                    : undefined
                }
                options={parents.map((p) => ({ value: p.id, label: p.name }))}
              />
              <TextField
                name="sortOrder"
                label="Sort order"
                type="number"
                min="0"
                hint="Lower numbers appear first."
                defaultValue={values.sortOrder}
                errors={e.sortOrder}
              />
              <TextField
                name="icon"
                label="Icon"
                placeholder="shirt"
                maxLength={50}
                hint="Optional icon name used by the storefront nav."
                defaultValue={values.icon}
                errors={e.icon}
              />
              <div className="border-t border-border pt-4">
                <CheckboxField
                  name="isActive"
                  label="Active"
                  hint="Inactive categories are hidden from the shop."
                  defaultChecked={values.isActive}
                />
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link
            href="/admin/categories"
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create category"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
