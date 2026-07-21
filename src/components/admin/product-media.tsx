"use client";

import { useActionState, useTransition } from "react";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addProductImage,
  addProductVariant,
  deleteProductImage,
  deleteProductVariant,
  setPrimaryImage,
  updateVariantStock,
} from "@/actions/admin/products";
import { initialFormState } from "@/actions/types";
import { FormMessage, SubmitButton, TextField } from "@/components/admin/form-fields";
import { EmptyState, Panel, StatusBadge } from "@/components/admin/ui";
import { SafeImage } from "@/components/safe-image";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

type ImageRow = { id: number; path: string; url: string | null; isPrimary: boolean };

export function ProductImages({
  productId,
  images,
}: {
  productId: number;
  images: ImageRow[];
}) {
  const [state, formAction] = useActionState(
    addProductImage.bind(null, productId),
    initialFormState,
  );
  const [pending, start] = useTransition();

  function remove(id: number) {
    start(async () => {
      const r = await deleteProductImage(id);
      if (r.ok) toast.success(r.message ?? "Removed");
      else toast.error(r.message ?? "Failed");
    });
  }

  function makePrimary(id: number) {
    start(async () => {
      const r = await setPrimaryImage(id);
      if (r.ok) toast.success(r.message ?? "Updated");
      else toast.error(r.message ?? "Failed");
    });
  }

  return (
    <Panel title="Images" description="The primary image is used across the shop.">
      <div className={cn("p-5", pending && "opacity-60")}>
        {images.length === 0 ? (
          <EmptyState title="No images yet" description="Add one below." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <li key={img.id} className="group relative">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-md bg-secondary">
                  <SafeImage
                    src={img.url}
                    alt=""
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                </span>

                {img.isPrimary && (
                  <span className="absolute left-2 top-2">
                    <StatusBadge label="Primary" tone="accent" />
                  </span>
                )}

                <div className="mt-2 flex items-center justify-between gap-1">
                  {!img.isPrimary ? (
                    <button
                      type="button"
                      onClick={() => makePrimary(img.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Star className="size-3.5" strokeWidth={1.8} />
                      Make primary
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => remove(img.id)}
                    disabled={pending}
                    aria-label="Delete image"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={formAction} className="mt-6 space-y-4 border-t border-border pt-5">
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="imageUrl" label="Image URL" placeholder="https://…" />
            <div>
              <label htmlFor="f-img-file" className="text-sm font-medium">
                …or upload a file
              </label>
              <input
                id="f-img-file"
                name="imageFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="mt-1.5 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          </div>
          <SubmitButton>Add image</SubmitButton>
        </form>
      </div>
    </Panel>
  );
}

type VariantRow = {
  id: number;
  size: string | null;
  colorName: string | null;
  colorHex: string | null;
  sku: string | null;
  priceModifier: number;
  stockQuantity: number;
  isActive: boolean;
};

export function ProductVariants({
  productId,
  variants,
}: {
  productId: number;
  variants: VariantRow[];
}) {
  const [state, formAction] = useActionState(
    addProductVariant.bind(null, productId),
    initialFormState,
  );
  const [pending, start] = useTransition();

  function remove(id: number) {
    start(async () => {
      const r = await deleteProductVariant(id);
      if (r.ok) toast.success(r.message ?? "Removed");
      else toast.error(r.message ?? "Failed");
    });
  }

  function setStock(id: number, value: number) {
    start(async () => {
      const r = await updateVariantStock(id, value);
      if (!r.ok) toast.error(r.message ?? "Failed");
    });
  }

  return (
    <Panel
      title="Variants"
      description="Sizes and colours. Stock is tracked per variant when variants exist."
    >
      <div className={cn("p-5", pending && "opacity-60")}>
        {variants.length === 0 ? (
          <EmptyState
            title="No variants"
            description="Without variants, the product's own stock quantity is used."
          />
        ) : (
          <ul className="divide-y divide-border">
            {variants.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex min-w-40 flex-1 items-center gap-2">
                  {v.colorHex && (
                    <span
                      className="size-4 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: v.colorHex }}
                    />
                  )}
                  <span className="text-sm">
                    {[v.size, v.colorName].filter(Boolean).join(" / ") || "—"}
                    {!v.isActive && (
                      <span className="ml-2">
                        <StatusBadge label="Inactive" tone="neutral" />
                      </span>
                    )}
                  </span>
                </span>

                <span className="text-xs text-muted-foreground">{v.sku ?? "No SKU"}</span>

                <span className="text-xs text-muted-foreground tabular-nums">
                  {v.priceModifier > 0 ? `+${formatPrice(v.priceModifier)}` : "—"}
                </span>

                <label className="flex items-center gap-1.5">
                  <span className="sr-only">Stock for this variant</span>
                  <input
                    type="number"
                    min={0}
                    defaultValue={v.stockQuantity}
                    disabled={pending}
                    onBlur={(ev) => {
                      const next = Number(ev.target.value);
                      if (Number.isFinite(next) && next !== v.stockQuantity) {
                        setStock(v.id, next);
                      }
                    }}
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm tabular-nums outline-none focus:border-primary"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => remove(v.id)}
                  disabled={pending}
                  aria-label="Delete variant"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form action={formAction} className="mt-6 space-y-4 border-t border-border pt-5">
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <TextField name="size" label="Size" placeholder="M" errors={state.errors?.size} />
            <TextField
              name="colorName"
              label="Colour"
              placeholder="Indigo"
              errors={state.errors?.colorName}
            />
            <TextField name="colorHex" label="Hex" placeholder="#2B3A67" maxLength={7} />
            <TextField name="sku" label="SKU" />
            <TextField
              name="priceModifier"
              label="Price +/−"
              type="number"
              step="0.01"
              defaultValue="0"
            />
            <TextField
              name="stockQuantity"
              label="Stock"
              type="number"
              min="0"
              defaultValue="0"
            />
          </div>
          <SubmitButton>Add variant</SubmitButton>
        </form>
      </div>
    </Panel>
  );
}
