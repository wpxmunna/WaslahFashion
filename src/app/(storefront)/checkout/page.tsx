import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SafeImage } from "@/components/safe-image";

import { CheckoutForm, type CheckoutAddress } from "@/components/checkout-form";
import { getSession } from "@/lib/auth";
import { getCartView } from "@/lib/cart";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const { lines, totals } = await getCartView();
  if (lines.length === 0) redirect("/cart");

  // A line that went out of stock must be resolved in the bag first.
  if (lines.some((l) => l.hasIssue)) redirect("/cart");

  const session = await getSession();

  const [addressRows, couriers] = await Promise.all([
    session
      ? prisma.address.findMany({
          where: { userId: session.userId },
          orderBy: [{ isDefault: "desc" }, { id: "desc" }],
        })
      : Promise.resolve([]),
    prisma.courier.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, name: true, description: true, estimatedDays: true },
    }),
  ]);

  const addresses: CheckoutAddress[] = addressRows.map((a) => ({
    id: a.id,
    label: a.label,
    name: a.name,
    phone: a.phone,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    isDefault: a.isDefault,
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <h1 className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight">Checkout</h1>

      {!session && (
        <p className="mt-4 text-sm text-muted-foreground">
          Checking out as a guest.{" "}
          <Link href="/login?redirectTo=/checkout" className="link-wipe text-foreground">
            Sign in
          </Link>{" "}
          to use a saved address.
        </p>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <CheckoutForm
          addresses={addresses}
          couriers={couriers}
          subtotal={totals.subtotal}
          shipping={totals.shipping}
        />

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="border border-border p-6">
            <h2 className="kicker text-muted-foreground">Your order</h2>

            <ul className="mt-5 space-y-4">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-3">
                  <div className="relative aspect-[3/4] w-14 shrink-0 overflow-hidden bg-muted">
                    {line.image && (
                      <SafeImage
                        src={line.image}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    )}
                    <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[0.65rem] tabular-nums text-background">
                      {line.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{line.name}</p>
                    {line.variantLabel && (
                      <p className="text-xs text-muted-foreground">{line.variantLabel}</p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm tabular-nums">
                    {formatPrice(line.lineTotal)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">
                  {totals.shipping === 0 ? "Free" : formatPrice(totals.shipping)}
                </dd>
              </div>
              {totals.tax > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="tabular-nums">{formatPrice(totals.tax)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="font-display text-lg">Total</dt>
                <dd className="font-display text-lg tabular-nums">
                  {formatPrice(totals.total)}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
