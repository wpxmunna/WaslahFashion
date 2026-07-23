"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  createManualOrder,
  getOrderableVariants,
  type ManualOrderInput,
  type OrderableVariant,
} from "@/actions/admin/orders";
import { searchPosCustomers, searchPosProducts, type PosProductRow } from "@/actions/admin/pos";
import { SelectField, TextField, TextareaField } from "@/components/admin/form-fields";
import { Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { PAYMENT_METHODS } from "@/lib/orders";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

type Line = {
  key: number;
  productId: number;
  productName: string;
  basePrice: number;
  variants: OrderableVariant[];
  variantId: number | null;
  quantity: string;
  unitPrice: string;
};

const SOURCES = ["WhatsApp", "Facebook", "Instagram", "Phone", "In person", "Other"];

let keySeq = 1;

export function OrderCreateForm() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);

  // Product search
  const [pQuery, setPQuery] = useState("");
  const [pResults, setPResults] = useState<PosProductRow[]>([]);
  const pTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Customer
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [cQuery, setCQuery] = useState("");
  const [cResults, setCResults] = useState<{ id: number; name: string; phone: string | null }[]>([]);
  const cTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    shippingName: "",
    shippingPhone: "",
    shippingLine1: "",
    shippingLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingPostalCode: "",
    source: "WhatsApp",
    paymentMethod: "cod",
    status: "PROCESSING" as ManualOrderInput["status"],
    paymentStatus: "PENDING" as ManualOrderInput["paymentStatus"],
    shippingAmount: "0",
    discountAmount: "0",
    notes: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function searchProducts(q: string) {
    setPQuery(q);
    if (pTimer.current) clearTimeout(pTimer.current);
    if (q.trim().length < 2) {
      setPResults([]);
      return;
    }
    pTimer.current = setTimeout(async () => {
      setPResults(await searchPosProducts(q));
    }, 250);
  }

  async function addProduct(p: PosProductRow) {
    const variants = await getOrderableVariants(p.id);
    const first = variants[0];
    setLines((ls) => [
      ...ls,
      {
        key: keySeq++,
        productId: p.id,
        productName: p.name,
        basePrice: p.price,
        variants,
        variantId: first?.id ?? null,
        quantity: "1",
        unitPrice: (p.price + (first?.priceModifier ?? 0)).toFixed(2),
      },
    ]);
    setPQuery("");
    setPResults([]);
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function changeVariant(key: number, variantId: number) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const v = l.variants.find((x) => x.id === variantId);
        return { ...l, variantId, unitPrice: (l.basePrice + (v?.priceModifier ?? 0)).toFixed(2) };
      }),
    );
  }
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));

  function searchCustomers(q: string) {
    setCQuery(q);
    setCustomerId(null);
    if (cTimer.current) clearTimeout(cTimer.current);
    if (q.trim().length < 2) {
      setCResults([]);
      return;
    }
    cTimer.current = setTimeout(async () => {
      setCResults(await searchPosCustomers(q));
    }, 250);
  }
  function pickCustomer(c: { id: number; name: string; phone: string | null }) {
    setCustomerId(c.id);
    setCQuery(c.name);
    setCResults([]);
    setForm((f) => ({ ...f, shippingName: c.name, shippingPhone: c.phone ?? f.shippingPhone }));
  }

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unitPrice) || 0) * (parseInt(l.quantity) || 0), 0);
  const shippingAmt = parseFloat(form.shippingAmount) || 0;
  const discountAmt = parseFloat(form.discountAmount) || 0;
  const total = Math.max(0, subtotal + shippingAmt - discountAmt);

  function submit() {
    setError(null);
    if (lines.length === 0) {
      setError("Add at least one product.");
      return;
    }
    const input: ManualOrderInput = {
      customerId,
      shippingName: form.shippingName.trim(),
      shippingPhone: form.shippingPhone.trim(),
      shippingLine1: form.shippingLine1.trim(),
      shippingLine2: form.shippingLine2.trim() || undefined,
      shippingCity: form.shippingCity.trim(),
      shippingState: form.shippingState.trim() || undefined,
      shippingPostalCode: form.shippingPostalCode.trim() || undefined,
      paymentMethod: form.paymentMethod,
      status: form.status,
      paymentStatus: form.paymentStatus,
      shippingAmount: shippingAmt,
      discountAmount: discountAmt,
      source: form.source,
      notes: form.notes.trim() || undefined,
      lines: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: parseInt(l.quantity) || 1,
        unitPrice: parseFloat(l.unitPrice) || 0,
      })),
    };

    start(async () => {
      const result = await createManualOrder(input);
      if (result.ok) {
        toast.success(`Order ${result.orderNumber} created.`);
        router.push(`/admin/orders/${result.orderId}`);
      } else {
        setError(result.message);
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <Panel title="Products" description="Search the catalogue and add the items ordered.">
          <div className="space-y-4 p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={pQuery}
                onChange={(e) => searchProducts(e.target.value)}
                placeholder="Search by name, SKU or barcode"
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              {pResults.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-xl">
                  {pResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {p.sku ?? "No SKU"} · {p.stock} in stock
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">{formatPrice(p.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length === 0 ? (
              <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                No products yet. Search above to add items.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {lines.map((l) => (
                  <li key={l.key} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate font-medium">{l.productName}</p>
                      {l.variants.length > 0 && (
                        <select
                          value={l.variantId ?? ""}
                          onChange={(e) => changeVariant(l.key, Number(e.target.value))}
                          className="w-full max-w-xs rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                        >
                          {l.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.label} — {v.stock} in stock
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="text-xs text-muted-foreground">
                        Qty
                        <input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                          className="mt-1 w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Unit price
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                          className="mt-1 w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm tabular-nums outline-none focus:border-primary"
                        />
                      </label>
                      <span className="min-w-[5rem] pb-2 text-right text-sm font-medium tabular-nums">
                        {formatPrice((parseFloat(l.unitPrice) || 0) * (parseInt(l.quantity) || 0))}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        aria-label="Remove item"
                        className="mb-1 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" strokeWidth={1.8} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Customer & delivery" description="Where the order ships. Link an existing account or enter details.">
          <div className="space-y-4 p-5">
            <div className="relative">
              <label className="text-sm font-medium">Link existing customer (optional)</label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={cQuery}
                  onChange={(e) => searchCustomers(e.target.value)}
                  placeholder="Search customer by name, phone or email"
                  className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                {customerId && (
                  <button
                    type="button"
                    onClick={() => { setCustomerId(null); setCQuery(""); }}
                    aria-label="Clear customer"
                    className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-secondary"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {cResults.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-xl">
                  {cResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickCustomer(c)}
                        className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-secondary"
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{c.phone ?? "—"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {customerId && (
                <p className="mt-1 text-xs text-primary">Linked to an existing customer account.</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="shippingName" label="Customer name" required value={form.shippingName} onChange={(e) => set("shippingName", e.target.value)} />
              <TextField name="shippingPhone" label="Phone" required value={form.shippingPhone} onChange={(e) => set("shippingPhone", e.target.value)} />
              <TextField name="shippingLine1" label="Address" required className="sm:col-span-2" value={form.shippingLine1} onChange={(e) => set("shippingLine1", e.target.value)} />
              <TextField name="shippingLine2" label="Address line 2" className="sm:col-span-2" value={form.shippingLine2} onChange={(e) => set("shippingLine2", e.target.value)} />
              <TextField name="shippingCity" label="City" required value={form.shippingCity} onChange={(e) => set("shippingCity", e.target.value)} />
              <TextField name="shippingState" label="District / State" value={form.shippingState} onChange={(e) => set("shippingState", e.target.value)} />
              <TextField name="shippingPostalCode" label="Postal code" value={form.shippingPostalCode} onChange={(e) => set("shippingPostalCode", e.target.value)} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Order">
          <div className="space-y-4 p-5">
            <SelectField name="source" label="Order source" value={form.source} onChange={(e) => set("source", e.target.value)} options={SOURCES.map((s) => ({ value: s, label: s }))} />
            <SelectField name="paymentMethod" label="Payment method" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))} />
            <SelectField name="status" label="Order status" value={form.status} onChange={(e) => set("status", e.target.value)} options={[
              { value: "PENDING", label: "Pending" },
              { value: "PROCESSING", label: "Processing" },
              { value: "SHIPPED", label: "Shipped" },
              { value: "DELIVERED", label: "Delivered" },
            ]} />
            <SelectField name="paymentStatus" label="Payment status" value={form.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)} options={[
              { value: "PENDING", label: "Awaiting payment" },
              { value: "PAID", label: "Paid" },
            ]} />
            <div className="grid grid-cols-2 gap-4">
              <TextField name="shippingAmount" label="Delivery charge" type="number" step="0.01" min="0" value={form.shippingAmount} onChange={(e) => set("shippingAmount", e.target.value)} />
              <TextField name="discountAmount" label="Discount" type="number" step="0.01" min="0" value={form.discountAmount} onChange={(e) => set("discountAmount", e.target.value)} />
            </div>
            <TextareaField name="notes" label="Notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} hint="Visible on the order." />
          </div>
        </Panel>

        <Panel title="Summary">
          <div className="space-y-2 p-5 text-sm">
            <Row label={`Subtotal (${lines.length} item${lines.length === 1 ? "" : "s"})`} value={formatPrice(subtotal)} />
            <Row label="Delivery" value={formatPrice(shippingAmt)} />
            {discountAmt > 0 && <Row label="Discount" value={`−${formatPrice(discountAmt)}`} />}
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <span className="font-display text-base font-bold">Total</span>
              <span className="font-display text-lg font-bold tabular-nums">{formatPrice(total)}</span>
            </div>
          </div>
          <div className="border-t border-border p-5">
            {error && <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">{error}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={pending || lines.length === 0}
              className={cn(buttonVariants({ size: "lg" }), "h-11 w-full gap-2")}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" strokeWidth={2} />}
              Create order
            </button>
          </div>
        </Panel>
      </div>
    </div>
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
