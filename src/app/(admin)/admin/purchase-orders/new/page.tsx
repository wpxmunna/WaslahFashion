import { PageHeader } from "@/components/admin/ui";
import { PoForm } from "@/components/admin/po-form";
import { emptyPoValues } from "@/components/admin/po-form-constants";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "New purchase order" };

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, costPrice: true },
    }),
  ]);

  // A supplier can be preselected when arriving from the supplier detail page.
  const requested = Number(first(raw.supplier));
  const preselected = suppliers.some((s) => s.id === requested) ? requested : undefined;

  return (
    <>
      <PageHeader
        title="New purchase order"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/purchase-orders", label: "Purchase orders" },
        ]}
      />
      <PoForm
        values={emptyPoValues(preselected)}
        suppliers={suppliers}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          costPrice: p.costPrice === null ? null : toNumber(p.costPrice),
        }))}
      />
    </>
  );
}
