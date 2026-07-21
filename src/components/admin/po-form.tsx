"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from "@/actions/admin/purchase-orders";
import { initialFormState } from "@/actions/types";
import {
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

export type PoProductOption = {
  id: number;
  name: string;
  sku: string | null;
  costPrice: number | null;
};

export type PoLineValues = {
  productId: number | null;
  productName: string;
  quantityOrdered: string;
  unitCost: string;
};

export type PoFormValues = {
  id?: number;
  supplierId: number | null;
  orderDate: string;
  expectedDate: string;
  status: "DRAFT" | "PENDING";
  taxAmount: string;
  shippingAmount: string;
  discountAmount: string;
  notes: string;
  lines: PoLineValues[];
};

type EditorLine = PoLineValues & { key: number };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptyPoValues(supplierId?: number): PoFormValues {
  return {
    supplierId: supplierId ?? null,
    orderDate: today(),
    expectedDate: "",
    status: "DRAFT",
    taxAmount: "0",
    shippingAmount: "0",
    discountAmount: "0",
    notes: "",
    lines: [],
  };
}

const blankLine = (key: number): EditorLine => ({
  key,
  productId: null,
  productName: "",
  quantityOrdered: "1",
  unitCost: "0",
});

function money(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PoForm({
  values,
  suppliers,
  products,
}: {
  values: PoFormValues;
  suppliers: { id: number; name: string }[];
  products: PoProductOption[];
}) {
  const isEdit = typeof values.id === "number";
  const listId = useId();

  const action = isEdit
    ? updatePurchaseOrder.bind(null, values.id as number)
    : createPurchaseOrder;

  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};

  const [nextKey, setNextKey] = useState(values.lines.length + 1);
  const [lines, setLines] = useState<EditorLine[]>(
    values.lines.length > 0
      ? values.lines.map((line, i) => ({ ...line, key: i }))
      : [blankLine(0)],
  );

  const [tax, setTax] = useState(values.taxAmount);
  const [shipping, setShipping] = useState(values.shippingAmount);
  const [discount, setDiscount] = useState(values.discountAmount);

  // Datalist labels have to round-trip back to a product, so they must be
  // unique — the SKU disambiguates two products sharing a name.
  const labelFor = (p: PoProductOption) => (p.sku ? `${p.name} (${p.sku})` : p.name);
  const byLabel = new Map(products.map((p) => [labelFor(p), p]));

  function patch(key: number, changes: Partial<EditorLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...changes } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, blankLine(nextKey)]);
    setNextKey((k) => k + 1);
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length === 1 ? [blankLine(nextKey)] : prev.filter((l) => l.key !== key)));
    setNextKey((k) => k + 1);
  }

  /** Typing a product's exact label links the line and seeds its cost. */
  function onNameChange(line: EditorLine, value: string) {
    const match = byLabel.get(value);
    if (match) {
      patch(line.key, {
        productName: value,
        productId: match.id,
        unitCost:
          line.unitCost === "0" || line.unitCost === ""
            ? String(match.costPrice ?? 0)
            : line.unitCost,
      });
    } else {
      patch(line.key, { productName: value, productId: null });
    }
  }

  const lineTotals = lines.map((l) => {
    const qty = Number(l.quantityOrdered);
    const cost = Number(l.unitCost);
    return Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0;
  });

  const subtotal = lineTotals.reduce((sum, n) => sum + n, 0);
  const total = Math.max(
    0,
    subtotal + (Number(tax) || 0) + (Number(shipping) || 0) - (Number(discount) || 0),
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <div className="px-1">
          <FormMessage state={state} />
        </div>
      )}

      <datalist id={listId}>
        {products.map((p) => (
          <option key={p.id} value={labelFor(p)} />
        ))}
      </datalist>

      <Panel title="Order">
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            name="supplierId"
            label="Supplier"
            required
            placeholder="Choose a supplier"
            defaultValue={values.supplierId ?? ""}
            errors={e.supplierId}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
          <TextField
            name="orderDate"
            label="Order date"
            type="date"
            required
            defaultValue={values.orderDate}
            errors={e.orderDate}
          />
          <TextField
            name="expectedDate"
            label="Expected date"
            type="date"
            defaultValue={values.expectedDate}
            errors={e.expectedDate}
          />
          <SelectField
            name="status"
            label="Status"
            defaultValue={values.status}
            errors={e.status}
            hint="Approve the order from its detail page."
            options={[
              { value: "DRAFT", label: "Draft" },
              { value: "PENDING", label: "Pending approval" },
            ]}
          />
        </div>
      </Panel>

      <Panel
        title="Line items"
        description="Pick a catalogue product, or type any name for a one-off item."
        actions={
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
          >
            <Plus className="size-3.5" strokeWidth={1.8} />
            Add line
          </button>
        }
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="border-b border-border bg-secondary/40">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Product
                </th>
                <th
                  scope="col"
                  className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Quantity
                </th>
                <th
                  scope="col"
                  className="w-36 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Unit cost
                </th>
                <th
                  scope="col"
                  className="w-36 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Total
                </th>
                <th scope="col" className="w-12 px-4 py-3">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line, i) => (
                <tr key={line.key}>
                  <td className="px-4 py-2">
                    <input type="hidden" name="itemProductId" value={line.productId ?? ""} />
                    <input
                      name="itemProductName"
                      list={listId}
                      value={line.productName}
                      onChange={(ev) => onNameChange(line, ev.target.value)}
                      aria-label={`Product for line ${i + 1}`}
                      placeholder="Search the catalogue or type a name"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    {line.productId !== null && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Linked to the catalogue — receiving will add to its stock.
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      name="itemQuantity"
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantityOrdered}
                      onChange={(ev) =>
                        patch(line.key, { quantityOrdered: ev.target.value })
                      }
                      aria-label={`Quantity for line ${i + 1}`}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      name="itemUnitCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitCost}
                      onChange={(ev) => patch(line.key, { unitCost: ev.target.value })}
                      aria-label={`Unit cost for line ${i + 1}`}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums">
                    {money(lineTotals[i] ?? 0)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      aria-label={`Remove line ${i + 1}`}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" strokeWidth={1.8} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Notes">
          <div className="p-5">
            <TextareaField
              name="notes"
              label="Order notes"
              rows={5}
              defaultValue={values.notes}
              errors={e.notes}
            />
          </div>
        </Panel>

        <Panel title="Totals">
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{money(subtotal)}</span>
            </div>

            <TextField
              name="taxAmount"
              label={`Tax (${CURRENCY.code})`}
              type="number"
              step="0.01"
              min="0"
              value={tax}
              onChange={(ev) => setTax(ev.target.value)}
              errors={e.taxAmount}
            />
            <TextField
              name="shippingAmount"
              label="Shipping"
              type="number"
              step="0.01"
              min="0"
              value={shipping}
              onChange={(ev) => setShipping(ev.target.value)}
              errors={e.shippingAmount}
            />
            <TextField
              name="discountAmount"
              label="Discount"
              type="number"
              step="0.01"
              min="0"
              hint="Taken off after tax and shipping."
              value={discount}
              onChange={(ev) => setDiscount(ev.target.value)}
              errors={e.discountAmount}
            />

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="font-medium">Total</span>
              <span className="font-display text-xl tabular-nums">
                {CURRENCY.symbol} {money(total)}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <FormActions>
          <Link
            href="/admin/purchase-orders"
            className={buttonVariants({ variant: "outline" })}
          >
            Cancel
          </Link>
          <SubmitButton>{isEdit ? "Save changes" : "Create purchase order"}</SubmitButton>
        </FormActions>
      </Panel>
    </form>
  );
}
