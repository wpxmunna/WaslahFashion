"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Loader2,
  Minus,
  PauseCircle,
  Plus,
  ScanLine,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  completeSale,
  deleteHeldOrder,
  holdOrder,
  lookupBarcode,
  recallHeldOrder,
  searchPosCustomers,
  searchPosProducts,
  type PosCustomerRow,
  type PosProductRow,
} from "@/actions/admin/pos";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { CURRENCY } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import {
  computeTotals,
  lineTotal,
  PAYMENT_METHOD_LABELS,
  POS_PAYMENT_METHODS,
  round2,
  type PosCartLine,
  type PosPaymentMethodValue,
} from "@/lib/pos";
import { cn } from "@/lib/utils";

export type PosHeldOrderRow = {
  id: number;
  holdNumber: string;
  customerName: string | null;
  note: string | null;
  itemCount: number;
  total: number;
  createdAt: string;
};

export type PosShiftSummary = {
  id: number;
  shiftNumber: string;
  terminalName: string;
  totalSales: number;
  totalTransactions: number;
};

const controlClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";

function numberOr(value: string, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function PosTerminal({
  shift,
  products,
  heldOrders,
}: {
  shift: PosShiftSummary;
  products: PosProductRow[];
  heldOrders: PosHeldOrderRow[];
}) {
  const router = useRouter();

  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [query, setQuery] = useState("");
  // Keyed by the query they answered, so a stale result set is simply not shown
  // rather than being cleared with a synchronous setState in an effect.
  const [remote, setRemote] = useState<{ query: string; results: PosProductRow[] }>({
    query: "",
    results: [],
  });
  const [barcode, setBarcode] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<{
    query: string;
    results: PosCustomerRow[];
  }>({ query: "", results: [] });

  const [orderDiscount, setOrderDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethodValue>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [mobileAmount, setMobileAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [scanning, startScan] = useTransition();
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [holding, startHold] = useTransition();

  /* ------------------------------------------------------------- catalogue */

  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  // Only reach for the server when the pre-loaded page has nothing to show, so
  // typing stays instant for the common case.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || localMatches.length > 0) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        const results = await searchPosProducts(q);
        setRemote({ query: q, results });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, localMatches.length]);

  const visible =
    localMatches.length > 0
      ? localMatches
      : remote.query === query.trim()
        ? remote.results
        : [];

  /* ------------------------------------------------------------------ cart */

  function addProduct(product: PosProductRow) {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }

    setCart((current) => {
      const index = current.findIndex(
        (l) => l.productId === product.id && !l.variantId,
      );
      if (index === -1) {
        return [
          ...current,
          {
            productId: product.id,
            variantId: null,
            name: product.name,
            sku: product.sku,
            unitPrice: product.price,
            quantity: 1,
            discount: 0,
            stock: product.stock,
          },
        ];
      }

      const line = current[index];
      if (line.quantity >= product.stock) {
        toast.warning(`Only ${product.stock} of ${product.name} in stock.`);
        return current;
      }
      const next = [...current];
      next[index] = { ...line, quantity: line.quantity + 1 };
      return next;
    });
  }

  function setQuantity(index: number, quantity: number) {
    setCart((current) => {
      const line = current[index];
      if (!line) return current;
      if (quantity < 1) return current.filter((_, i) => i !== index);

      const cap = line.stock ?? Number.MAX_SAFE_INTEGER;
      if (quantity > cap) {
        toast.warning(`Only ${cap} of ${line.name} in stock.`);
        return current;
      }
      const next = [...current];
      next[index] = { ...line, quantity };
      return next;
    });
  }

  function setLineDiscount(index: number, value: number) {
    setCart((current) => {
      const line = current[index];
      if (!line) return current;
      const max = round2(line.unitPrice * line.quantity);
      const next = [...current];
      next[index] = {
        ...line,
        discount: Math.min(Math.max(0, round2(value)), max),
      };
      return next;
    });
  }

  function removeLine(index: number) {
    setCart((current) => current.filter((_, i) => i !== index));
  }

  function resetSale() {
    setCart([]);
    setOrderDiscount("0");
    setCashReceived("");
    setCardAmount("");
    setMobileAmount("");
    setNotes("");
    setCustomerId(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerQuery("");
    setPaymentMethod("CASH");
    barcodeRef.current?.focus();
  }

  /* --------------------------------------------------------------- totals */

  const totals = useMemo(
    () => computeTotals(cart, numberOr(orderDiscount)),
    [cart, orderDiscount],
  );

  const cash = numberOr(cashReceived);
  const card = numberOr(cardAmount);
  const mobile = numberOr(mobileAmount);
  const change = paymentMethod === "CASH" ? round2(Math.max(0, cash - totals.total)) : 0;
  const splitSum = round2(cash + card + mobile);
  const splitRemaining = round2(totals.total - splitSum);

  const paymentReady =
    cart.length === 0
      ? false
      : paymentMethod === "CASH"
        ? cash + 0.005 >= totals.total
        : paymentMethod === "MIXED"
          ? Math.abs(splitRemaining) <= 0.01
          : true;

  /* -------------------------------------------------------------- barcode */

  function submitBarcode(event: React.FormEvent) {
    event.preventDefault();
    const code = barcode.trim();
    if (!code) return;

    startScan(async () => {
      const product = await lookupBarcode(code);
      if (!product) toast.error(`Nothing matches "${code}".`);
      else addProduct(product);
      setBarcode("");
      barcodeRef.current?.focus();
    });
  }

  /* ------------------------------------------------------------- customer */

  useEffect(() => {
    const q = customerQuery.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => {
      void searchPosCustomers(q).then((results) =>
        setCustomerResults({ query: q, results }),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  // Clearing the search box is enough to hide the list — no effect required.
  const visibleCustomers =
    customerQuery.trim().length >= 2 && customerResults.query === customerQuery.trim()
      ? customerResults.results
      : [];

  function chooseCustomer(customer: PosCustomerRow) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone ?? "");
    setCustomerQuery("");
  }

  /* ------------------------------------------------------------ hold/recall */

  function hold() {
    if (cart.length === 0) {
      toast.error("Nothing to hold.");
      return;
    }
    startHold(async () => {
      const result = await holdOrder({
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId ?? null,
          name: l.name,
          sku: l.sku ?? null,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          discount: l.discount,
        })),
        customerId,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        note: notes || undefined,
      });

      if (result.ok) {
        toast.success(result.message ?? "Order held.");
        resetSale();
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not hold the order.");
      }
    });
  }

  function recall(id: number) {
    startHold(async () => {
      const result = await recallHeldOrder(id);
      if (!result.ok || !result.order) {
        toast.error(result.message ?? "Could not recall that order.");
        return;
      }

      setCart(
        result.order.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          name: item.name,
          sku: item.sku ?? null,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discount: item.discount,
          // Stock is re-checked server-side on completion; the held snapshot
          // has no live figure to trust.
          stock: undefined,
        })),
      );
      setCustomerId(result.order.customerId);
      setCustomerName(result.order.customerName ?? "");
      setCustomerPhone(result.order.customerPhone ?? "");
      toast.success("Order recalled into the cart.");
      router.refresh();
    });
  }

  function discardHeld(id: number) {
    startHold(async () => {
      const result = await deleteHeldOrder(id);
      if (result.ok) {
        toast.success(result.message ?? "Deleted.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not delete.");
      }
    });
  }

  /* ------------------------------------------------------------------ sale */

  function submitSale() {
    if (cart.length === 0) {
      toast.error("The cart is empty.");
      return;
    }

    startSave(async () => {
      const result = await completeSale({
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId ?? null,
          quantity: l.quantity,
          discount: l.discount,
        })),
        customerId,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        orderDiscount: numberOr(orderDiscount),
        paymentMethod,
        cashReceived: paymentMethod === "CASH" || paymentMethod === "MIXED" ? cash : 0,
        cardAmount: paymentMethod === "MIXED" ? card : 0,
        mobileAmount: paymentMethod === "MIXED" ? mobile : 0,
        notes: notes || undefined,
      });

      if (!result.ok || !result.transactionId) {
        toast.error(result.message ?? "Could not complete the sale.");
        return;
      }

      toast.success(
        result.changeAmount
          ? `${result.transactionNumber} — change ${formatPrice(result.changeAmount)}`
          : (result.transactionNumber ?? "Sale completed."),
      );
      resetSale();
      router.push(`/admin/pos/receipt/${result.transactionId}`);
    });
  }

  /* ------------------------------------------------------------------- UI */

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
      {/* ------------------------------------------------------ catalogue */}
      <div className="space-y-5">
        <Panel>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <form onSubmit={submitBarcode}>
              <label htmlFor="pos-barcode" className="text-sm font-medium">
                Scan barcode
              </label>
              <div className="relative mt-1.5">
                <ScanLine
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.7}
                />
                <input
                  id="pos-barcode"
                  ref={barcodeRef}
                  value={barcode}
                  autoFocus
                  autoComplete="off"
                  onChange={(event) => setBarcode(event.target.value)}
                  onBlur={() => {
                    // Keep the scanner's focus unless the cashier is typing
                    // somewhere else on purpose.
                    if (!document.activeElement || document.activeElement === document.body) {
                      barcodeRef.current?.focus();
                    }
                  }}
                  placeholder="Scan or type a code, then Enter"
                  className={cn(controlClass, "mt-0 pl-9 pr-9")}
                />
                {scanning && (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </form>

            <div>
              <label htmlFor="pos-search" className="text-sm font-medium">
                Search products
              </label>
              <div className="relative mt-1.5">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.7}
                />
                <input
                  id="pos-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name or SKU"
                  className={cn(controlClass, "mt-0 pl-9")}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border p-4">
            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {searching ? "Searching…" : "No products match that search."}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {visible.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      disabled={product.stock <= 0}
                      className="flex h-full w-full flex-col justify-between gap-2 rounded-md border border-border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="line-clamp-2 text-sm font-medium leading-snug">
                        {product.name}
                      </span>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm tabular-nums">
                          {formatPrice(product.price)}
                        </span>
                        <span
                          className={cn(
                            "text-xs tabular-nums",
                            product.stock <= 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {product.stock} left
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel
          title="Held orders"
          description="Parked carts for this store. Recalling one loads it back in."
        >
          {heldOrders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nothing on hold.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {heldOrders.map((held) => (
                <li
                  key={held.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{held.holdNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {held.itemCount} item{held.itemCount === 1 ? "" : "s"} ·{" "}
                      {formatPrice(held.total)}
                      {held.customerName ? ` · ${held.customerName}` : ""}
                      {held.note ? ` · ${held.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={holding}
                      onClick={() => recall(held.id)}
                    >
                      Recall
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={holding}
                      aria-label={`Delete held order ${held.holdNumber}`}
                      onClick={() => discardHeld(held.id)}
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.8} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ----------------------------------------------------------- cart */}
      <div className="space-y-5">
        <Panel
          title="Current sale"
          description={`${shift.terminalName} · ${shift.shiftNumber}`}
          actions={
            cart.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetSale}>
                <X className="size-3.5" strokeWidth={1.8} />
                Clear
              </Button>
            ) : undefined
          }
        >
          {cart.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Scan or tap a product to start a sale.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {cart.map((line, index) => (
                <li key={`${line.productId}-${line.variantId ?? 0}`} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(line.unitPrice)} each
                        {line.sku ? ` · ${line.sku}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      aria-label={`Remove ${line.name}`}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" strokeWidth={1.8} />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-md border border-border">
                      <button
                        type="button"
                        onClick={() => setQuantity(index, line.quantity - 1)}
                        aria-label={`Decrease quantity of ${line.name}`}
                        className="grid size-7 place-items-center text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        <Minus className="size-3" strokeWidth={2} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        aria-label={`Quantity of ${line.name}`}
                        onChange={(event) =>
                          setQuantity(index, Math.trunc(numberOr(event.target.value, 1)))
                        }
                        className="w-12 border-x border-border bg-transparent py-1 text-center text-sm tabular-nums outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(index, line.quantity + 1)}
                        aria-label={`Increase quantity of ${line.name}`}
                        className="grid size-7 place-items-center text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        <Plus className="size-3" strokeWidth={2} />
                      </button>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="sr-only sm:not-sr-only">Discount</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.discount || ""}
                        placeholder="0.00"
                        aria-label={`Discount on ${line.name}`}
                        onChange={(event) =>
                          setLineDiscount(index, numberOr(event.target.value))
                        }
                        className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-primary"
                      />
                    </label>

                    <span className="ml-auto text-sm font-medium tabular-nums">
                      {formatPrice(lineTotal(line))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-border p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPrice(totals.subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="pos-order-discount" className="text-muted-foreground">
                Order discount
              </label>
              <input
                id="pos-order-discount"
                type="number"
                min={0}
                step="0.01"
                value={orderDiscount}
                onChange={(event) => setOrderDiscount(event.target.value)}
                className="w-28 rounded-md border border-border bg-background px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span className="tabular-nums">{formatPrice(totals.tax)}</span>
            </div>

            <div className="flex justify-between border-t border-border pt-2 font-display text-lg">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(totals.total)}</span>
            </div>
          </div>
        </Panel>

        {/* ------------------------------------------------------ customer */}
        <Panel title="Customer" description="Optional — leave blank for a walk-in.">
          <div className="space-y-3 p-4">
            <div className="relative">
              <label htmlFor="pos-customer-search" className="text-sm font-medium">
                Find an existing customer
              </label>
              <div className="relative mt-1.5">
                <UserRound
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.7}
                />
                <input
                  id="pos-customer-search"
                  type="search"
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Name or phone"
                  className={cn(controlClass, "mt-0 pl-9")}
                />
              </div>

              {visibleCustomers.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
                  {visibleCustomers.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => chooseCustomer(customer)}
                        className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                      >
                        <span className="font-medium">{customer.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {customer.phone ?? customer.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="pos-customer-name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="pos-customer-name"
                  value={customerName}
                  onChange={(event) => {
                    setCustomerName(event.target.value);
                    setCustomerId(null);
                  }}
                  placeholder="Walk-in"
                  className={cn(controlClass, "mt-1.5")}
                />
              </div>
              <div>
                <label htmlFor="pos-customer-phone" className="text-sm font-medium">
                  Phone
                </label>
                <input
                  id="pos-customer-phone"
                  value={customerPhone}
                  onChange={(event) => {
                    setCustomerPhone(event.target.value);
                    setCustomerId(null);
                  }}
                  className={cn(controlClass, "mt-1.5")}
                />
              </div>
            </div>

            {customerId && (
              <p className="text-xs text-muted-foreground">
                Linked to an existing customer account.
              </p>
            )}
          </div>
        </Panel>

        {/* ------------------------------------------------------- payment */}
        <Panel title="Payment">
          <div className="space-y-3 p-4">
            <div>
              <label htmlFor="pos-payment-method" className="text-sm font-medium">
                Method
              </label>
              <select
                id="pos-payment-method"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PosPaymentMethodValue)
                }
                className={cn(controlClass, "mt-1.5")}
              >
                {POS_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </div>

            {paymentMethod === "CASH" && (
              <>
                <div>
                  <label htmlFor="pos-cash" className="text-sm font-medium">
                    Cash received ({CURRENCY.code})
                  </label>
                  <input
                    id="pos-cash"
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    className={cn(controlClass, "mt-1.5 text-right tabular-nums")}
                  />
                </div>
                <div className="flex justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Change</span>
                  <span className="font-medium tabular-nums">{formatPrice(change)}</span>
                </div>
              </>
            )}

            {paymentMethod === "MIXED" && (
              <div className="space-y-3">
                {(
                  [
                    ["Cash", cashReceived, setCashReceived, "pos-mix-cash"],
                    ["Card", cardAmount, setCardAmount, "pos-mix-card"],
                    ["Mobile banking", mobileAmount, setMobileAmount, "pos-mix-mobile"],
                  ] as const
                ).map(([label, value, setter, id]) => (
                  <div key={id}>
                    <label htmlFor={id} className="text-sm font-medium">
                      {label} ({CURRENCY.code})
                    </label>
                    <input
                      id={id}
                      type="number"
                      min={0}
                      step="0.01"
                      value={value}
                      onChange={(event) => setter(event.target.value)}
                      className={cn(controlClass, "mt-1.5 text-right tabular-nums")}
                    />
                  </div>
                ))}

                <p
                  className={cn(
                    "rounded-md px-3 py-2 text-sm",
                    Math.abs(splitRemaining) <= 0.01
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {Math.abs(splitRemaining) <= 0.01
                    ? "Split matches the total."
                    : splitRemaining > 0
                      ? `${formatPrice(splitRemaining)} still to allocate.`
                      : `${formatPrice(Math.abs(splitRemaining))} over the total.`}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="pos-notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="pos-notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={cn(controlClass, "mt-1.5 resize-y")}
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                size="lg"
                disabled={!paymentReady || saving}
                onClick={submitSale}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Complete sale · {formatPrice(totals.total)}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={cart.length === 0 || holding}
                onClick={hold}
              >
                <PauseCircle className="size-4" strokeWidth={1.8} />
                Hold order
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
