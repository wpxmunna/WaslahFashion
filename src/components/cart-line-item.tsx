"use client";
import { SafeImage } from "@/components/safe-image";

import Link from "next/link";
import { Loader2, Minus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { removeCartItem, updateCartItem } from "@/actions/cart";
import type { CartLine } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CartLineItem({ line }: { line: CartLine }) {
  const [pending, startTransition] = useTransition();

  function change(quantity: number) {
    startTransition(async () => {
      const result = await updateCartItem(line.id, quantity);
      if (!result.ok) toast.error(result.message);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCartItem(line.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <li
      className={cn(
        "flex gap-4 py-6 transition-opacity sm:gap-6",
        pending && "opacity-55",
      )}
    >
      <Link
        href={`/product/${line.slug}`}
        className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden bg-muted sm:w-28"
      >
        {line.image ? (
          <SafeImage
            src={line.image}
            alt={line.name}
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <span className="grid h-full place-items-center font-display text-2xl text-foreground/20">
            {line.name.charAt(0)}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg leading-snug">
              <Link href={`/product/${line.slug}`} className="link-wipe">
                {line.name}
              </Link>
            </h3>
            {line.variantLabel && (
              <p className="mt-1 text-sm text-muted-foreground">{line.variantLabel}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground tabular-nums">
              {formatPrice(line.unitPrice)} each
            </p>
          </div>

          <p className="shrink-0 text-right font-display text-lg tabular-nums">
            {formatPrice(line.lineTotal)}
          </p>
        </div>

        {line.hasIssue && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
            <TriangleAlert className="size-3.5 shrink-0" strokeWidth={1.8} />
            {line.issue}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-4 pt-4">
          <div className="flex items-center border border-border">
            <button
              type="button"
              onClick={() => change(line.quantity - 1)}
              disabled={pending}
              aria-label={`Decrease quantity of ${line.name}`}
              className="grid size-9 place-items-center transition-colors hover:bg-secondary disabled:opacity-40"
            >
              <Minus className="size-3.5" strokeWidth={1.8} />
            </button>
            <span className="w-10 text-center text-sm tabular-nums">
              {pending ? (
                <Loader2 className="mx-auto size-3.5 animate-spin" />
              ) : (
                line.quantity
              )}
            </span>
            <button
              type="button"
              onClick={() => change(line.quantity + 1)}
              disabled={pending || line.quantity >= line.availableStock}
              aria-label={`Increase quantity of ${line.name}`}
              className="grid size-9 place-items-center transition-colors hover:bg-secondary disabled:opacity-40"
            >
              <Plus className="size-3.5" strokeWidth={1.8} />
            </button>
          </div>

          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3.5" strokeWidth={1.7} />
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
