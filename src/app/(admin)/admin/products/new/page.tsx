import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { emptyProductValues } from "@/components/admin/product-form-constants";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const [categories, sizeCharts] = await Promise.all([
    prisma.category.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
    prisma.sizeChart.findMany({
      where: { storeId: DEFAULT_STORE_ID },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="New product"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/products", label: "Products" },
        ]}
      />
      <ProductForm
        values={emptyProductValues}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.parent ? `${c.parent.name} → ${c.name}` : c.name,
        }))}
        sizeCharts={sizeCharts}
      />
    </>
  );
}
