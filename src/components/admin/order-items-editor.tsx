"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  addOrderItem,
  getOrderableVariants,
  removeOrderItem,
  updateOrderItemQuantity,
  type OrderableVariant,
} from "@/actions/admin/orders";
import { searchPosProducts, type PosProductRow } from "@/actions/admin/pos";
import { DataTable, TBody, THead, Td, Th } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/ui";
import { formatPrice } from "@/lib/money";

export type EditableItem = {
  id: number;
  productName: string;
  variantInfo: string | null;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isGift: boolean;
};

export function OrderItemsEditor({
  orderId,
  items,
  totals,
}: {
  orderId: number;
  items: EditableItem[];
  totals: { subtotal: number; discount: number; shipping: number; tax: number; total: number; couponCode: string | null };
}) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        router.refresh();
      } else {
        toast.error(r.message ?? "Something went wrong");
      }
    });
  }

  // --- Add product ---------------------------------------------------------
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosProductRow[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draft, setDraft] = useState<{
    product: PosProductRow;
    variants: OrderableVariant[];
    variantId: number | null;
    quantity: string;
    unitPrice: string;
  } | null>(null);

  function search(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) return setResults([]);
    timer.current = setTimeout(async () => setResults(await searchPosProducts(q)), 250);
  }
  async function pick(p: PosProductRow) {
    const variants = await getOrderableVariants(p.id);
    const first = variants[0];
    setDraft({
      product: p,
      variants,
      variantId: first?.id ?? null,
      quantity: "1",
      unitPrice: (p.price + (first?.priceModifier ?? 0)).toFixed(2),
    });
    setResults([]);
    setQuery("");
  }
  function confirmAdd() {
    if (!draft) return;
    run(() =>
      addOrderItem(orderId, {
        productId: draft.product.id,
        variantId: draft.variantId,
        quantity: parseInt(draft.quantity) || 1,
        unitPrice: parseFloat(draft.unitPrice) || 0,
      }).then((r) => {
        if (r.ok) {
          setDraft(null);
          setAdding(false);
        }
        return r;
      }),
    );
  }

  return (
    <>
      <DataTable>
        <THead>
          <Th>Product</Th>
          <Th align="right">Unit price</Th>
          <Th align="center">Qty</Th>
          <Th align="right">Total</Th>
          <Th align="right"> </Th>
        </THead>
        <TBody>
          {items.map((item) => (
            <tr key={item.id}>
              <Td>
                <span className="block font-medium">
                  {item.productName}
                  {item.isGift && (
                    <span className="ml-2 align-middle">
                      <StatusBadge label="Gift" tone="accent" />
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[item.variantInfo, item.productSku].filter(Boolean).join(" · ") || "No variant"}
                </span>
              </Td>
              <Td align="right" className="tabular-nums">
                {formatPrice(item.unitPrice)}
              </Td>
              <Td align="center">
                {item.isGift ? (
                  <span className="tabular-nums">{item.quantity}</span>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-border">
                    <button
                      type="button"
                      disabled={busy || item.quantity <= 1}
                      onClick={() => run(() => updateOrderItemQuantity(item.id, item.quantity - 1))}
                      aria-label="Decrease"
                      className="grid size-7 place-items-center disabled:opacity-40"
                    >
                      <Minus className="size-3.5" strokeWidth={2} />
                    </button>
                    <span className="min-w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => updateOrderItemQuantity(item.id, item.quantity + 1))}
                      aria-label="Increase"
                      className="grid size-7 place-items-center disabled:opacity-40"
                    >
                      <Plus className="size-3.5" strokeWidth={2} />
                    </button>
                  </span>
                )}
              </Td>
              <Td align="right" className="tabular-nums">
                {formatPrice(item.totalPrice)}
              </Td>
              <Td align="right">
                {!item.isGift && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => removeOrderItem(item.id))}
                    aria-label="Remove item"
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="size-4" strokeWidth={1.8} />
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </TBody>
      </DataTable>

      {/* Add-product row */}
      <div className="border-t border-border p-4">
        {!adding && !draft ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-4" strokeWidth={2} />
            Add product
          </button>
        ) : draft ? (
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{draft.product.name}</p>
              {draft.variants.length > 0 && (
                <select
                  value={draft.variantId ?? ""}
                  onChange={(e) => {
                    const v = draft.variants.find((x) => x.id === Number(e.target.value));
                    setDraft({
                      ...draft,
                      variantId: Number(e.target.value),
                      unitPrice: (draft.product.price + (v?.priceModifier ?? 0)).toFixed(2),
                    });
                  }}
                  className="mt-1 w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                >
                  {draft.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} — {v.stock} in stock
                    </option>
                  ))}
                </select>
              )}
            </div>
            <label className="text-xs text-muted-foreground">
              Qty
              <input
                type="number"
                min={1}
                value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                className="mt-1 w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Unit price
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.unitPrice}
                onChange={(e) => setDraft({ ...draft, unitPrice: e.target.value })}
                className="mt-1 w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums outline-none focus:border-primary"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={confirmAdd}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add
            </button>
            <button
              type="button"
              onClick={() => { setDraft(null); setAdding(false); }}
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
              aria-label="Cancel"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search product to add"
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button
              type="button"
              onClick={() => { setAdding(false); setQuery(""); setResults([]); }}
              className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-secondary"
              aria-label="Cancel"
            >
              <X className="size-4" />
            </button>
            {results.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-xl">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.stock} in stock</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{formatPrice(p.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-border p-5">
        <div className="ml-auto max-w-sm space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
          {totals.discount > 0 && (
            <Row label={`Discount${totals.couponCode ? ` (${totals.couponCode})` : ""}`} value={`−${formatPrice(totals.discount)}`} />
          )}
          <Row label="Shipping" value={formatPrice(totals.shipping)} />
          {totals.tax > 0 && <Row label="Tax" value={formatPrice(totals.tax)} />}
          <div className="flex items-baseline justify-between border-t border-border pt-2 text-base font-medium">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(totals.total)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
