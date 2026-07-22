"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createProduct, updateProduct } from "@/actions/admin/products";
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
import { CURRENCY } from "@/lib/config";

export type ProductFormValues = {
  id?: number;
  name: string;
  slug: string;
  categoryId: number | null;
  shortDescription: string;
  material: string;
  description: string;
  price: string;
  salePrice: string;
  costPrice: string;
  sku: string;
  barcode: string;
  stockQuantity: string;
  lowStockThreshold: string;
  weight: string;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
  isFeatured: boolean;
  isNew: boolean;
  metaTitle: string;
  metaDescription: string;
  sizeChartId: number | null;
};

export function ProductForm({
  values,
  categories,
  sizeCharts,
}: {
  values: ProductFormValues;
  categories: { id: number; name: string }[];
  sizeCharts: { id: number; name: string }[];
}) {
  const isEdit = typeof values.id === "number";

  const action = isEdit
    ? updateProduct.bind(null, values.id as number)
    : createProduct;

  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

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
                defaultValue={values.name}
                errors={e.name}
                className="sm:col-span-2"
              />
              <TextField
                name="slug"
                label="URL slug"
                hint="Leave blank to generate from the name."
                defaultValue={values.slug}
                errors={e.slug}
                className="sm:col-span-2"
              />
              <TextareaField
                name="shortDescription"
                label="Short description"
                rows={2}
                maxLength={500}
                defaultValue={values.shortDescription}
                errors={e.shortDescription}
                className="sm:col-span-2"
              />
              <TextareaField
                name="description"
                label="Full description"
                rows={7}
                defaultValue={values.description}
                errors={e.description}
                className="sm:col-span-2"
              />
              <TextareaField
                name="material"
                label="Material & care"
                rows={3}
                maxLength={2000}
                defaultValue={values.material}
                errors={e.material}
                hint="Fabric/composition and care instructions. Shown under the product."
                placeholder={"100% Cotton handloom.\nWash cold, do not bleach, iron on low."}
                className="sm:col-span-2"
              />
            </div>
          </Panel>

          <Panel title="Pricing">
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <TextField
                name="price"
                label={`Price (${CURRENCY.code})`}
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={values.price}
                errors={e.price}
              />
              <TextField
                name="salePrice"
                label="Sale price"
                type="number"
                step="0.01"
                min="0"
                hint="Must be below the price."
                defaultValue={values.salePrice}
                errors={e.salePrice}
              />
              <TextField
                name="costPrice"
                label="Cost price"
                type="number"
                step="0.01"
                min="0"
                hint="Used for margin reporting."
                defaultValue={values.costPrice}
                errors={e.costPrice}
              />
            </div>
          </Panel>

          <Panel title="Inventory">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="sku"
                label="SKU"
                defaultValue={values.sku}
                errors={e.sku}
              />
              <TextField
                name="barcode"
                label="Barcode"
                hint="Scanned at the POS terminal."
                defaultValue={values.barcode}
                errors={e.barcode}
              />
              <TextField
                name="stockQuantity"
                label="Stock quantity"
                type="number"
                min="0"
                defaultValue={values.stockQuantity}
                errors={e.stockQuantity}
                hint={isEdit ? "Used when the product has no variants." : undefined}
              />
              <TextField
                name="lowStockThreshold"
                label="Low stock threshold"
                type="number"
                min="0"
                defaultValue={values.lowStockThreshold}
                errors={e.lowStockThreshold}
              />
              <TextField
                name="weight"
                label="Weight (kg)"
                type="number"
                step="0.01"
                min="0"
                defaultValue={values.weight}
                errors={e.weight}
              />
            </div>
          </Panel>

          <Panel title="Search engine listing">
            <div className="grid gap-4 p-5">
              <TextField
                name="metaTitle"
                label="Meta title"
                maxLength={255}
                defaultValue={values.metaTitle}
                errors={e.metaTitle}
              />
              <TextareaField
                name="metaDescription"
                label="Meta description"
                rows={2}
                maxLength={500}
                defaultValue={values.metaDescription}
                errors={e.metaDescription}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Organisation">
            <div className="space-y-4 p-5">
              <SelectField
                name="status"
                label="Status"
                defaultValue={values.status}
                errors={e.status}
                options={[
                  { value: "ACTIVE", label: "Active — visible in the shop" },
                  { value: "DRAFT", label: "Draft — hidden" },
                  { value: "INACTIVE", label: "Inactive — hidden" },
                ]}
              />
              <SelectField
                name="categoryId"
                label="Category"
                placeholder="Uncategorised"
                defaultValue={values.categoryId ?? ""}
                errors={e.categoryId}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              <SelectField
                name="sizeChartId"
                label="Size guide"
                placeholder="No size guide"
                defaultValue={values.sizeChartId ?? ""}
                errors={e.sizeChartId}
                options={sizeCharts.map((s) => ({ value: s.id, label: s.name }))}
                hint="Create and edit charts under Size charts."
              />
              <div className="space-y-3 border-t border-border pt-4">
                <CheckboxField
                  name="isFeatured"
                  label="Featured"
                  hint="Shown in the homepage feature grid."
                  defaultChecked={values.isFeatured}
                />
                <CheckboxField
                  name="isNew"
                  label="New arrival"
                  hint="Sorted to the front of new arrivals."
                  defaultChecked={values.isNew}
                />
              </div>
            </div>
          </Panel>

          {!isEdit && (
            <Panel title="First image" description="Optional — add more after saving.">
              <div className="space-y-4 p-5">
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
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/products" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create product"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}

