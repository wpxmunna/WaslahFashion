import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImages, ProductVariants } from "@/components/admin/product-media";
import { deleteProduct } from "@/actions/admin/products";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: product?.name ?? "Product" };
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
        variants: { orderBy: [{ size: "asc" }, { colorName: "asc" }] },
      },
    }),
    prisma.category.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
  ]);

  if (!product) notFound();

  const num = (v: unknown) => (v === null || v === undefined ? "" : String(toNumber(v as never)));

  return (
    <>
      <PageHeader
        title={product.name}
        description={`Slug: /product/${product.slug}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/products", label: "Products" },
        ]}
        actions={
          <>
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
            >
              View
              <ExternalLink className="size-3.5" strokeWidth={1.7} />
            </Link>
            <DeleteButton
              id={product.id}
              action={deleteProduct}
              redirectTo="/admin/products"
              label="Delete"
              confirmTitle="Delete this product?"
              confirmBody="If it appears on past orders it will be archived instead, so order history stays intact."
            />
          </>
        }
      />

      <ProductForm
        values={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          categoryId: product.categoryId,
          shortDescription: product.shortDescription ?? "",
          description: product.description ?? "",
          price: num(product.price),
          salePrice: product.salePrice === null ? "" : num(product.salePrice),
          costPrice: product.costPrice === null ? "" : num(product.costPrice),
          sku: product.sku ?? "",
          barcode: product.barcode ?? "",
          stockQuantity: String(product.stockQuantity),
          lowStockThreshold: String(product.lowStockThreshold),
          weight: product.weight === null ? "" : num(product.weight),
          status: product.status,
          isFeatured: product.isFeatured,
          isNew: product.isNew,
          metaTitle: product.metaTitle ?? "",
          metaDescription: product.metaDescription ?? "",
        }}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.parent ? `${c.parent.name} → ${c.name}` : c.name,
        }))}
      />

      <div className="mt-6 space-y-6">
        <ProductImages
          productId={product.id}
          images={product.images.map((i) => ({
            id: i.id,
            path: i.path,
            url: imageUrl(i.path),
            isPrimary: i.isPrimary,
          }))}
        />

        <ProductVariants
          productId={product.id}
          variants={product.variants.map((v) => ({
            id: v.id,
            size: v.size,
            colorName: v.colorName,
            colorHex: v.colorHex,
            sku: v.sku,
            priceModifier: toNumber(v.priceModifier),
            stockQuantity: v.stockQuantity,
            isActive: v.isActive,
          }))}
        />
      </div>
    </>
  );
}
