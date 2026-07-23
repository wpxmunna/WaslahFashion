"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { bulkUpdateProducts } from "@/actions/admin/products";
import { DataTable, StatusBadge, TBody, THead, Td, Th } from "@/components/admin/ui";
import { SafeImage } from "@/components/safe-image";
import { cn } from "@/lib/utils";

export type ProductRow = {
  id: number;
  name: string;
  sku: string | null;
  variants: number;
  featured: boolean;
  category: string | null;
  imageSrc: string | null;
  priceDisplay: string;
  originalDisplay: string | null;
  stock: number;
  low: boolean;
  status: string;
};

export function ProductBulkTable({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, start] = useTransition();

  const allSelected = products.length > 0 && selected.size === products.length;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  }

  function bulk(action: "activate" | "deactivate" | "draft" | "delete") {
    const ids = [...selected];
    start(async () => {
      const r = await bulkUpdateProducts(ids, action);
      if (r.ok) {
        toast.success(r.message ?? "Done");
        setSelected(new Set());
        setConfirmDelete(false);
        router.refresh();
      } else {
        toast.error(r.message ?? "Could not update");
      }
    });
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/40 px-4 py-3">
          <span className="mr-1 text-sm font-medium">{selected.size} selected</span>
          {confirmDelete ? (
            <>
              <span className="text-sm text-destructive">Delete {selected.size}?</span>
              <button type="button" disabled={busy} onClick={() => bulk("delete")} className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
                Confirm delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                Cancel
              </button>
            </>
          ) : (
            <>
              <BarBtn disabled={busy} onClick={() => bulk("activate")}>Activate</BarBtn>
              <BarBtn disabled={busy} onClick={() => bulk("draft")}>Set draft</BarBtn>
              <BarBtn disabled={busy} onClick={() => bulk("deactivate")}>Deactivate</BarBtn>
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">
                Delete
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-sm text-muted-foreground hover:text-foreground">
                Clear
              </button>
            </>
          )}
        </div>
      )}

      <DataTable>
        <THead>
          <Th className="w-10">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allSelected}
              onChange={toggleAll}
              className="size-4 accent-[var(--primary)]"
            />
          </Th>
          <Th>Product</Th>
          <Th>Category</Th>
          <Th align="right">Price</Th>
          <Th align="right">Stock</Th>
          <Th>Status</Th>
        </THead>
        <TBody>
          {products.map((p) => (
            <tr key={p.id} className={cn("hover:bg-secondary/40", selected.has(p.id) && "bg-primary/5")}>
              <Td>
                <input
                  type="checkbox"
                  aria-label={`Select ${p.name}`}
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="size-4 accent-[var(--primary)]"
                />
              </Td>
              <Td>
                <div className="flex items-center gap-3">
                  <span className="relative size-11 shrink-0 overflow-hidden rounded bg-secondary">
                    <SafeImage src={p.imageSrc} alt="" fill sizes="44px" className="object-cover" fallbackLabel={p.name} />
                  </span>
                  <span className="min-w-0">
                    <Link href={`/admin/products/${p.id}`} className="link-wipe block truncate font-medium">
                      {p.name}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.sku ?? "No SKU"}
                      {p.variants > 0 && ` · ${p.variants} variants`}
                      {p.featured && " · Featured"}
                    </span>
                  </span>
                </div>
              </Td>
              <Td className="text-muted-foreground">{p.category ?? "—"}</Td>
              <Td align="right" className="tabular-nums">
                {p.priceDisplay}
                {p.originalDisplay && (
                  <span className="ml-1.5 text-xs text-muted-foreground line-through">{p.originalDisplay}</span>
                )}
              </Td>
              <Td align="right">
                <span className={cn("tabular-nums", p.stock <= 0 ? "text-destructive" : p.low ? "text-amber-600" : "")}>
                  {p.stock}
                </span>
              </Td>
              <Td>
                <StatusBadge status={p.status} />
              </Td>
            </tr>
          ))}
        </TBody>
      </DataTable>
    </>
  );
}

function BarBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:opacity-60"
    >
      {children}
    </button>
  );
}
