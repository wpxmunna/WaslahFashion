"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { createCoupon, updateCoupon } from "@/actions/admin/coupons";
import { initialFormState } from "@/actions/types";
import {
  CheckboxField,
  FormActions,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/admin/form-fields";
import {
  COUPON_TYPES,
  COUPON_TYPE_HINTS,
  COUPON_TYPE_LABELS,
  type CouponType,
} from "@/components/admin/coupon-types";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { CURRENCY } from "@/lib/config";
import { cn } from "@/lib/utils";

export type CouponFormValues = {
  id?: number;
  code: string;
  type: CouponType;
  value: string;
  minimumAmount: string;
  maximumDiscount: string;
  giftProductId: number | null;
  buyQuantity: string;
  getQuantity: string;
  usageLimit: string;
  /** Pre-formatted for `datetime-local` (`YYYY-MM-DDTHH:mm`). */
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  usedCount: number;
};

export type GiftProductOption = { id: number; name: string; sku: string | null };

/**
 * Searchable product select for gift coupons.
 *
 * A plain `<select>` over a full catalogue is unusable, so a filter box sits
 * above a real listbox — keeping native keyboard behaviour and form posting
 * rather than reimplementing a combobox. The chosen product is always kept in
 * the option list so filtering can never silently drop the selection.
 */
function GiftProductPicker({
  products,
  defaultValue,
  errors,
}: {
  products: GiftProductOption[];
  defaultValue: number | null;
  errors?: string[];
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>(
    defaultValue === null ? "" : String(defaultValue),
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matches = needle
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            (p.sku ?? "").toLowerCase().includes(needle),
        )
      : products;

    const chosen = products.find((p) => String(p.id) === selected);
    if (chosen && !matches.some((p) => p.id === chosen.id)) return [chosen, ...matches];
    return matches;
  }, [products, search, selected]);

  const chosen = products.find((p) => String(p.id) === selected);

  return (
    <div className="sm:col-span-2">
      <label htmlFor="gift-search" className="text-sm font-medium">
        Gift product
        <span className="ml-0.5 text-destructive">*</span>
      </label>

      <input
        id="gift-search"
        type="search"
        value={search}
        onChange={(ev) => setSearch(ev.target.value)}
        placeholder="Filter by name or SKU"
        className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
      />

      <select
        name="giftProductId"
        aria-label="Gift product"
        size={6}
        value={selected}
        onChange={(ev) => setSelected(ev.target.value)}
        aria-invalid={errors?.length ? true : undefined}
        className={cn(
          "mt-2 w-full rounded-md border bg-background p-1 text-sm outline-none transition-colors",
          errors?.length
            ? "border-destructive focus:border-destructive"
            : "border-border focus:border-primary",
        )}
      >
        {visible.length === 0 && (
          <option value="" disabled>
            No products match “{search}”
          </option>
        )}
        {visible.map((p) => (
          <option key={p.id} value={p.id} className="rounded px-2 py-1">
            {p.name}
            {p.sku ? ` — ${p.sku}` : ""}
          </option>
        ))}
      </select>

      {errors?.length ? (
        <p className="mt-1 text-xs text-destructive">{errors[0]}</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {chosen ? `Selected: ${chosen.name}` : "Choose the product to give away."}
        </p>
      )}
    </div>
  );
}

export function CouponForm({
  values,
  products,
}: {
  values: CouponFormValues;
  products: GiftProductOption[];
}) {
  const isEdit = typeof values.id === "number";

  const action = isEdit ? updateCoupon.bind(null, values.id as number) : createCoupon;
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  // Drives which discount inputs exist at all. Fields for other types are
  // unmounted rather than hidden, so a switched type cannot post stale values.
  const [type, setType] = useState<CouponType>(values.type);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="Discount">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="code"
                label="Code"
                required
                maxLength={50}
                placeholder="SPRING20"
                hint="Saved in capitals. Letters, numbers, - and _ only."
                defaultValue={values.code}
                errors={e.code}
                style={{ textTransform: "uppercase" }}
              />

              <SelectField
                name="type"
                label="Type"
                value={type}
                onChange={(ev) => setType(ev.target.value as CouponType)}
                errors={e.type}
                hint={COUPON_TYPE_HINTS[type]}
                options={COUPON_TYPES.map((t) => ({
                  value: t,
                  label: COUPON_TYPE_LABELS[t],
                }))}
              />

              {type === "FIXED" && (
                <TextField
                  name="value"
                  label={`Amount off (${CURRENCY.code})`}
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={values.value}
                  errors={e.value}
                />
              )}

              {type === "PERCENTAGE" && (
                <>
                  <TextField
                    name="value"
                    label="Percentage off"
                    type="number"
                    step="0.01"
                    min="1"
                    max="100"
                    required
                    hint="Between 1 and 100."
                    defaultValue={values.value}
                    errors={e.value}
                  />
                  <TextField
                    name="maximumDiscount"
                    label={`Maximum discount (${CURRENCY.code})`}
                    type="number"
                    step="0.01"
                    min="0"
                    hint="Leave blank for no cap."
                    defaultValue={values.maximumDiscount}
                    errors={e.maximumDiscount}
                  />
                </>
              )}

              {type === "BUY_X_GET_Y" && (
                <>
                  <TextField
                    name="buyQuantity"
                    label="Buy quantity"
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={values.buyQuantity}
                    errors={e.buyQuantity}
                  />
                  <TextField
                    name="getQuantity"
                    label="Free quantity"
                    type="number"
                    min="1"
                    step="1"
                    required
                    hint="The cheapest qualifying units are the free ones."
                    defaultValue={values.getQuantity}
                    errors={e.getQuantity}
                  />
                </>
              )}

              {type === "GIFT_ITEM" && (
                <GiftProductPicker
                  products={products}
                  defaultValue={values.giftProductId}
                  errors={e.giftProductId}
                />
              )}

              {type === "FREE_SHIPPING" && (
                <p className="self-end pb-2 text-xs text-muted-foreground sm:col-span-2">
                  Free shipping coupons take the whole delivery charge off — there is
                  no discount value to set.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Conditions">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField
                name="minimumAmount"
                label={`Minimum spend (${CURRENCY.code})`}
                type="number"
                step="0.01"
                min="0"
                hint="0 means no minimum."
                defaultValue={values.minimumAmount}
                errors={e.minimumAmount}
              />
              <TextField
                name="usageLimit"
                label="Usage limit"
                type="number"
                min="1"
                step="1"
                hint="Leave blank for unlimited."
                defaultValue={values.usageLimit}
                errors={e.usageLimit}
              />
              <TextField
                name="startsAt"
                label="Starts"
                type="datetime-local"
                hint="Blank means it is live immediately."
                defaultValue={values.startsAt}
                errors={e.startsAt}
              />
              <TextField
                name="expiresAt"
                label="Expires"
                type="datetime-local"
                hint="Blank means it never expires."
                defaultValue={values.expiresAt}
                errors={e.expiresAt}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Status">
            <div className="space-y-4 p-5">
              <CheckboxField
                name="isActive"
                label="Active"
                hint="Inactive codes are rejected at checkout."
                defaultChecked={values.isActive}
              />
              {isEdit && (
                <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                  Redeemed {values.usedCount} time{values.usedCount === 1 ? "" : "s"}.
                  Usage is tracked automatically and cannot be edited here.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <FormActions>
          <Link href="/admin/coupons" className={buttonVariants({ variant: "outline" })}>
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create coupon"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
