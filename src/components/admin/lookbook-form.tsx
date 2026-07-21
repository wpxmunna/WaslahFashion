"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createLookbookItem, updateLookbookItem } from "@/actions/admin/lookbook";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";

export type LookbookFormValues = {
  id?: number;
  imageUrl: string | null;
  link: string;
  caption: string;
  isFeatured: boolean;
  sortOrder: string;
  isActive: boolean;
};

export function LookbookForm({
  values,
  featuredElsewhere,
}: {
  values: LookbookFormValues;
  /** Caption of the currently featured item, when it is not this one. */
  featuredElsewhere?: string | null;
}) {
  const isEdit = typeof values.id === "number";

  const action = isEdit
    ? updateLookbookItem.bind(null, values.id as number)
    : createLookbookItem;
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  const [preview, setPreview] = useState<string | null>(values.imageUrl);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Image"
          description={isEdit ? "Leave both blank to keep the current image." : undefined}
        >
          <div className="space-y-4 p-5">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md bg-secondary">
              {preview ? (
                // Preview only — a blob: or arbitrary remote URL is not worth
                // routing through the image optimiser.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                  No image yet
                </span>
              )}
            </div>

            <TextField
              name="imageUrl"
              label="Image URL"
              placeholder="https://…"
              defaultValue=""
              onChange={(ev) => setPreview(ev.target.value || values.imageUrl)}
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
                  if (file) setPreview(URL.createObjectURL(file));
                }}
                className="mt-1.5 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Details">
            <div className="space-y-4 p-5">
              <TextField
                name="caption"
                label="Caption"
                maxLength={255}
                hint="Shown over the image in the homepage mosaic."
                defaultValue={values.caption}
                errors={e.caption}
              />
              <TextField
                name="link"
                label="Link"
                placeholder="/shop/sarees"
                maxLength={255}
                hint="Where the tile goes when clicked. Optional."
                defaultValue={values.link}
                errors={e.link}
              />
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
                name="isFeatured"
                label="Featured"
                hint={
                  featuredElsewhere
                    ? `Only one item can be featured — this will replace “${featuredElsewhere}”.`
                    : "The featured item leads the homepage mosaic."
                }
                defaultChecked={values.isFeatured}
              />
              <CheckboxField
                name="isActive"
                label="Active"
                hint="Inactive items are hidden from the homepage."
                defaultChecked={values.isActive}
              />
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/lookbook" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Add item"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
