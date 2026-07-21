import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";

import { CartLineItem } from "@/components/cart-line-item";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCartView } from "@/lib/cart";
import { getShippingSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Your bag" };

export default async function CartPage() {
  const [{ lines, totals }, shipping] = await Promise.all([
    getCartView(),
    getShippingSettings(),
  ]);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28 text-center sm:px-6">
        <ShoppingBag
          className="mx-auto size-10 text-muted-foreground"
          strokeWidth={1.2}
        />
        <h1 className="mt-6 font-display text-3xl">Your bag is empty</h1>
        <p className="mt-3 text-muted-foreground">
          Nothing in here yet — the collection is a good place to start.
        </p>
        <Link
          href="/shop"
          className={cn(buttonVariants({ size: "lg" }), "mt-8 h-11 rounded-none px-8")}
        >
          Browse the collection
        </Link>
      </div>
    );
  }

  const blocked = lines.some((l) => l.hasIssue);
  const remaining = shipping.freeShippingThreshold - totals.subtotal;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <h1 className="font-display text-[clamp(2rem,4vw,3rem)] leading-tight">Your bag</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <section aria-label="Bag contents">
          <ul className="divide-y divide-border border-y border-border">
            {lines.map((line) => (
              <CartLineItem key={line.id} line={line} />
            ))}
          </ul>

          <Link
            href="/shop"
            className="link-wipe mt-6 inline-block text-sm text-muted-foreground"
          >
            Continue shopping
          </Link>
        </section>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="border border-border p-6">
            <h2 className="kicker text-muted-foreground">Summary</h2>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Subtotal ({totals.itemCount} {totals.itemCount === 1 ? "item" : "items"})
                </dt>
                <dd className="tabular-nums">{formatPrice(totals.subtotal)}</dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">
                  {totals.shipping === 0 ? (
                    <span className="text-accent-foreground">Free</span>
                  ) : (
                    formatPrice(totals.shipping)
                  )}
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

            {remaining > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  Add {formatPrice(remaining)} more for free delivery.
                </p>
                <div
                  className="mt-2 h-0.5 w-full bg-border"
                  role="progressbar"
                  aria-valuenow={Math.round((totals.subtotal / shipping.freeShippingThreshold) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progress toward free delivery"
                >
                  <div
                    className="h-full bg-accent transition-[width] duration-700"
                    style={{
                      width: `${Math.min(100, (totals.subtotal / shipping.freeShippingThreshold) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {blocked ? (
              <p className="mt-6 border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                Some items need attention before you can check out.
              </p>
            ) : (
              <Link
                href="/checkout"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "mt-6 h-12 w-full rounded-none text-base",
                )}
              >
                Checkout
                <ArrowRight className="size-4" strokeWidth={1.8} />
              </Link>
            )}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Cash on delivery available nationwide.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
