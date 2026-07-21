"use client";

import { useActionState, useState } from "react";
import { Loader2, TicketPercent } from "lucide-react";

import { applyCoupon, placeOrder } from "@/actions/checkout";
import { initialFormState } from "@/actions/types";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHODS } from "@/lib/orders";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

export type CheckoutAddress = {
  id: number;
  label: string;
  name: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  isDefault: boolean;
};

export type CheckoutCourier = {
  id: number;
  name: string;
  description: string | null;
  estimatedDays: string | null;
};

type Props = {
  addresses: CheckoutAddress[];
  couriers: CheckoutCourier[];
  subtotal: number;
  shipping: number;
};

export function CheckoutForm({ addresses, couriers, subtotal, shipping }: Props) {
  const [state, formAction, pending] = useActionState(placeOrder, initialFormState);
  const [couponState, couponAction, couponPending] = useActionState(
    applyCoupon,
    initialFormState,
  );

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const [selectedId, setSelectedId] = useState<number | "new">(
    defaultAddress ? defaultAddress.id : "new",
  );
  const [couponCode, setCouponCode] = useState("");

  const active = selectedId === "new" ? null : addresses.find((a) => a.id === selectedId) ?? null;

  return (
    <form action={formAction} className="space-y-10">
      {state.message && !state.ok && (
        <p
          role="alert"
          className="border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      {addresses.length > 0 && (
        <section>
          <h2 className="kicker text-muted-foreground">Deliver to</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => (
              <button
                key={address.id}
                type="button"
                onClick={() => setSelectedId(address.id)}
                aria-pressed={selectedId === address.id}
                className={cn(
                  "border p-4 text-left text-sm transition-colors",
                  selectedId === address.id
                    ? "border-foreground bg-secondary/60"
                    : "border-border hover:border-foreground/40",
                )}
              >
                <span className="kicker text-muted-foreground">{address.label}</span>
                <span className="mt-1.5 block font-medium">{address.name}</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {[address.addressLine1, address.addressLine2, address.city]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSelectedId("new")}
              aria-pressed={selectedId === "new"}
              className={cn(
                "border border-dashed p-4 text-left text-sm transition-colors",
                selectedId === "new"
                  ? "border-foreground bg-secondary/60"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <span className="kicker text-muted-foreground">New</span>
              <span className="mt-1.5 block font-medium">Use a different address</span>
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="kicker text-muted-foreground">Delivery address</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            name="shippingName"
            label="Full name"
            defaultValue={active?.name ?? ""}
            errors={state.errors?.shippingName}
            autoComplete="name"
            required
          />
          <Field
            name="shippingPhone"
            label="Phone"
            type="tel"
            defaultValue={active?.phone ?? ""}
            errors={state.errors?.shippingPhone}
            autoComplete="tel"
            required
          />
          <Field
            name="shippingLine1"
            label="Address"
            className="sm:col-span-2"
            defaultValue={active?.addressLine1 ?? ""}
            errors={state.errors?.shippingLine1}
            autoComplete="address-line1"
            required
          />
          <Field
            name="shippingLine2"
            label="Apartment, suite (optional)"
            className="sm:col-span-2"
            defaultValue={active?.addressLine2 ?? ""}
            errors={state.errors?.shippingLine2}
            autoComplete="address-line2"
          />
          <Field
            name="shippingCity"
            label="City"
            defaultValue={active?.city ?? ""}
            errors={state.errors?.shippingCity}
            autoComplete="address-level2"
            required
          />
          <Field
            name="shippingState"
            label="District (optional)"
            defaultValue={active?.state ?? ""}
            errors={state.errors?.shippingState}
            autoComplete="address-level1"
          />
          <Field
            name="shippingPostalCode"
            label="Postcode (optional)"
            defaultValue={active?.postalCode ?? ""}
            errors={state.errors?.shippingPostalCode}
            autoComplete="postal-code"
          />
        </div>
      </section>

      {couriers.length > 0 && (
        <section>
          <h2 className="kicker text-muted-foreground">Courier</h2>
          <div className="mt-4 space-y-2">
            {couriers.map((courier, i) => (
              <label
                key={courier.id}
                className="flex cursor-pointer items-start gap-3 border border-border p-4 text-sm transition-colors has-[:checked]:border-foreground has-[:checked]:bg-secondary/60"
              >
                <input
                  type="radio"
                  name="courierId"
                  value={courier.id}
                  defaultChecked={i === 0}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-medium">{courier.name}</span>
                  {courier.description && (
                    <span className="mt-0.5 block text-muted-foreground">
                      {courier.description}
                    </span>
                  )}
                  {courier.estimatedDays && courier.estimatedDays !== "0" && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {courier.estimatedDays} days
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="kicker text-muted-foreground">Payment</h2>
        <div className="mt-4 space-y-2">
          {PAYMENT_METHODS.map((method, i) => (
            <label
              key={method.value}
              className="flex cursor-pointer items-start gap-3 border border-border p-4 text-sm transition-colors has-[:checked]:border-foreground has-[:checked]:bg-secondary/60"
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.value}
                defaultChecked={i === 0}
                className="mt-1 accent-[var(--primary)]"
              />
              <span>
                <span className="block font-medium">{method.label}</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {method.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        {state.errors?.paymentMethod && (
          <p className="mt-2 text-xs text-destructive">{state.errors.paymentMethod[0]}</p>
        )}
      </section>

      <section>
        <h2 className="kicker text-muted-foreground">Coupon</h2>
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <TicketPercent
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.6}
            />
            <input
              name="couponCode"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              aria-label="Coupon code"
              className="h-11 w-full border border-border bg-background pl-9 pr-3 text-sm uppercase outline-none focus:border-foreground"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            formAction={couponAction}
            disabled={couponPending || !couponCode}
            className="h-11 rounded-none"
          >
            {couponPending ? <Loader2 className="size-4 animate-spin" /> : "Check"}
          </Button>
        </div>
        {couponState.message && (
          <p
            className={cn(
              "mt-2 text-xs",
              couponState.ok ? "text-accent-foreground" : "text-destructive",
            )}
          >
            {couponState.message}
          </p>
        )}
      </section>

      <section>
        <label htmlFor="notes" className="kicker text-muted-foreground">
          Order notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Landmarks, delivery preferences, anything we should know."
          className="mt-3 w-full resize-y border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
        />
      </section>

      <div className="border-t border-border pt-6">
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-12 w-full rounded-none text-base"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Placing your order…
            </>
          ) : (
            <>Place order · {formatPrice(subtotal + shipping)}</>
          )}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Coupon discounts are applied when your order is placed.
        </p>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  errors,
  className,
  ...props
}: {
  name: string;
  label: string;
  errors?: string[];
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label htmlFor={id} className="kicker text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        className={cn(
          "mt-1.5 h-11 w-full border bg-background px-3 text-sm outline-none transition-colors",
          errors ? "border-destructive" : "border-border focus:border-foreground",
        )}
        {...props}
      />
      {errors && (
        <p id={errorId} className="mt-1 text-xs text-destructive">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
