"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { addToCart } from "@/actions/cart";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

export type PurchaseVariant = {
  id: number;
  size: string | null;
  colorName: string | null;
  colorHex: string | null;
  priceModifier: number;
  stockQuantity: number;
};

type Props = {
  productId: number;
  basePrice: number;
  /** Stock on the product itself, used when the product has no variants. */
  productStock: number;
  variants: PurchaseVariant[];
};

export function ProductPurchase({ productId, basePrice, productStock, variants }: Props) {
  const hasVariants = variants.length > 0;

  const sizes = useMemo(
    () => [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))],
    [variants],
  );
  const colors = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const v of variants) {
      if (v.colorName && !seen.has(v.colorName)) seen.set(v.colorName, v.colorHex);
    }
    return [...seen.entries()].map(([name, hex]) => ({ name, hex }));
  }, [variants]);

  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(colors[0]?.name ?? null);
  const [quantity, setQuantity] = useState(1);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(() => {
    if (!hasVariants) return null;
    return (
      variants.find(
        (v) =>
          (sizes.length === 0 || v.size === size) &&
          (colors.length === 0 || v.colorName === color),
      ) ?? null
    );
  }, [hasVariants, variants, sizes.length, colors.length, size, color]);

  /** A size/colour pair with no variant row, or one that's sold out. */
  function combinationStock(nextSize: string | null, nextColor: string | null): number {
    const match = variants.find(
      (v) =>
        (sizes.length === 0 || v.size === nextSize) &&
        (colors.length === 0 || v.colorName === nextColor),
    );
    return match?.stockQuantity ?? 0;
  }

  const stock = hasVariants ? (selected?.stockQuantity ?? 0) : productStock;
  const unitPrice = basePrice + (selected?.priceModifier ?? 0);
  const soldOut = stock <= 0;
  const needsSelection = hasVariants && !selected;

  function submit() {
    const formData = new FormData();
    formData.set("productId", String(productId));
    formData.set("quantity", String(quantity));
    if (selected) formData.set("variantId", String(selected.id));

    startTransition(async () => {
      const result = await addToCart(formData);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="space-y-7">
      <p className="flex items-baseline gap-3">
        <span className="font-display text-3xl tabular-nums">{formatPrice(unitPrice)}</span>
        {selected && selected.priceModifier > 0 && (
          <span className="text-xs text-muted-foreground">
            includes {formatPrice(selected.priceModifier)} size surcharge
          </span>
        )}
      </p>

      {colors.length > 0 && (
        <fieldset>
          <legend className="kicker text-muted-foreground">
            Colour{color ? <span className="text-foreground"> — {color}</span> : null}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {colors.map((c) => {
              const active = c.name === color;
              const available = combinationStock(size, c.name) > 0;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.name)}
                  aria-pressed={active}
                  title={available ? c.name : `${c.name} — out of stock`}
                  className={cn(
                    "relative grid size-9 place-items-center rounded-full border transition-all",
                    active
                      ? "border-foreground ring-1 ring-foreground ring-offset-2 ring-offset-background"
                      : "border-border hover:border-foreground/50",
                    !available && "opacity-40",
                  )}
                >
                  <span
                    className="size-7 rounded-full border border-black/10"
                    style={{ backgroundColor: c.hex ?? "#ccc" }}
                  />
                  {active && (
                    <Check
                      className="absolute size-3.5 text-white mix-blend-difference"
                      strokeWidth={3}
                    />
                  )}
                  <span className="sr-only">{c.name}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset>
          <legend className="kicker text-muted-foreground">Size</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const active = s === size;
              const available = combinationStock(s, color) > 0;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  aria-pressed={active}
                  className={cn(
                    "min-w-12 border px-3.5 py-2.5 text-sm transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border hover:border-foreground/50",
                    !available && "text-muted-foreground line-through",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center border border-border">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="grid size-11 place-items-center transition-colors hover:bg-secondary disabled:opacity-35"
          >
            <Minus className="size-4" strokeWidth={1.7} />
          </button>
          <span
            aria-live="polite"
            className="w-12 text-center text-sm tabular-nums"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(Math.max(stock, 1), q + 1))}
            disabled={quantity >= stock}
            aria-label="Increase quantity"
            className="grid size-11 place-items-center transition-colors hover:bg-secondary disabled:opacity-35"
          >
            <Plus className="size-4" strokeWidth={1.7} />
          </button>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={submit}
          disabled={pending || soldOut || needsSelection}
          className="h-11 flex-1 rounded-none px-8"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Adding…
            </>
          ) : soldOut ? (
            "Sold out"
          ) : (
            <>
              <ShoppingBag className="size-4" strokeWidth={1.7} />
              Add to bag
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {soldOut
          ? "This combination is currently unavailable."
          : stock <= 5
            ? `Only ${stock} left in stock.`
            : "In stock, ready to ship."}
      </p>
    </div>
  );
}
