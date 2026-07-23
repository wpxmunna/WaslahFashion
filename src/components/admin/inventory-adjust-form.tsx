"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { adjustStock, getStockTarget, type StockTarget } from "@/actions/admin/inventory";
import { searchPosProducts, type PosProductRow } from "@/actions/admin/pos";
import { Panel } from "@/components/admin/ui";
import { ADJUSTMENT_REASONS } from "@/lib/inventory";

export function InventoryAdjustForm() {
  const router = useRouter();
  const [busy, start] = useTransition();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosProductRow[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [target, setTarget] = useState<StockTarget | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [newQty, setNewQty] = useState("");
  const [reason, setReason] = useState<string>(ADJUSTMENT_REASONS[0]);
  const [note, setNote] = useState("");

  function search(q: string) {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) return setResults([]);
    timer.current = setTimeout(async () => setResults(await searchPosProducts(q)), 250);
  }

  async function pick(p: PosProductRow) {
    const t = await getStockTarget(p.id);
    if (!t) return;
    setTarget(t);
    setVariantId(t.variants[0]?.id ?? null);
    setNewQty(String(t.variants[0]?.stock ?? t.baseStock));
    setResults([]);
    setQuery("");
  }

  function reset() {
    setTarget(null);
    setVariantId(null);
    setNewQty("");
    setNote("");
    setReason(ADJUSTMENT_REASONS[0]);
  }

  const current = target
    ? variantId
      ? (target.variants.find((v) => v.id === variantId)?.stock ?? 0)
      : target.baseStock
    : 0;
  const parsedQty = parseInt(newQty);
  const delta = Number.isFinite(parsedQty) ? parsedQty - current : 0;

  function submit() {
    if (!target) return;
    start(async () => {
      const r = await adjustStock({
        productId: target.productId,
        variantId,
        newQuantity: Number.isFinite(parsedQty) ? parsedQty : current,
        reason,
        note: note.trim() || undefined,
      });
      if (r.ok) {
        toast.success(r.message ?? "Adjusted");
        reset();
        router.refresh();
      } else {
        toast.error(r.message ?? "Could not adjust stock");
      }
    });
  }

  return (
    <Panel title="Adjust stock" description="Correct on-hand stock and record why.">
      <div className="space-y-4 p-5">
        {!target ? (
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Search a product by name, SKU or barcode"
              className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {results.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-xl">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => pick(p)}
                      className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.stock} in stock</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/30 px-4 py-3">
              <div>
                <p className="font-medium">{target.productName}</p>
                <p className="text-xs text-muted-foreground">
                  Current stock: <span className="tabular-nums">{current}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                aria-label="Choose another product"
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {target.variants.length > 0 && (
                <label className="text-sm font-medium sm:col-span-2">
                  Variant
                  <select
                    value={variantId ?? ""}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setVariantId(id);
                      setNewQty(String(target.variants.find((v) => v.id === id)?.stock ?? 0));
                    }}
                    className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    {target.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} — {v.stock} in stock
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-sm font-medium">
                New quantity
                <input
                  type="number"
                  min={0}
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                {delta !== 0 && Number.isFinite(parsedQty) && (
                  <span className={`mt-1 block text-xs ${delta > 0 ? "text-primary" : "text-destructive"}`}>
                    {delta > 0 ? "+" : ""}
                    {delta} vs current
                  </span>
                )}
              </label>

              <label className="text-sm font-medium">
                Reason
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                >
                  {ADJUSTMENT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium sm:col-span-2">
                Note (optional)
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. found in back store, damaged in transit"
                  className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={busy || delta === 0 || !Number.isFinite(parsedQty)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save adjustment
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}
