import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { CategoryForm } from "@/components/admin/category-form";
import { parentOptions } from "@/components/admin/category-options";
import { PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { deleteCategory } from "@/actions/admin/categories";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const category = await prisma.category.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: category?.name ?? "Category" };
}

export default async function EditCategoryPage({ params }: Props) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) notFound();

  const [category, categories] = await Promise.all([
    prisma.category.findFirst({
      where: { id: categoryId, storeId: DEFAULT_STORE_ID },
      select: {
        id: true,
        parentId: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        _count: { select: { products: true, children: true } },
      },
    }),
    prisma.category.findMany({
      where: { storeId: DEFAULT_STORE_ID },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true },
    }),
  ]);

  if (!category) notFound();

  const { products, children } = category._count;
  const blocked = products > 0 || children > 0;

  return (
    <>
      <PageHeader
        title={category.name}
        description={`Slug: /${category.slug}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/categories", label: "Categories" },
        ]}
        actions={
          <DeleteButton
            id={category.id}
            action={deleteCategory}
            redirectTo="/admin/categories"
            label="Delete"
            confirmTitle="Delete this category?"
            confirmBody={
              blocked
                ? "This category still has products or subcategories, so the delete will be refused until those are moved."
                : "This cannot be undone."
            }
          />
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Products"
          value={String(products)}
          hint={products === 0 ? "Nothing filed here yet" : "Filed in this category"}
        />
        <StatCard
          label="Subcategories"
          value={String(children)}
          hint={children === 0 ? "No child categories" : "Nested beneath this one"}
        />
        <StatCard
          label="Visibility"
          value={category.isActive ? "Active" : "Inactive"}
          hint={category.isActive ? "Shown in the shop" : "Hidden from the shop"}
        />
      </div>

      <CategoryForm
        values={{
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          parentId: category.parentId,
          icon: category.icon ?? "",
          sortOrder: String(category.sortOrder),
          isActive: category.isActive,
          imageUrl: imageUrl(category.image),
        }}
        parents={parentOptions(categories, category.id)}
      />

      {blocked && (
        <Panel className="mt-6">
          <p className="p-5 text-sm text-muted-foreground">
            This category cannot be deleted while it holds{" "}
            {products > 0 && `${products} product${products === 1 ? "" : "s"}`}
            {products > 0 && children > 0 && " and "}
            {children > 0 &&
              `${children} subcategor${children === 1 ? "y" : "ies"}`}
            . Move or delete {products > 0 || children > 1 ? "them" : "it"} first.
          </p>
        </Panel>
      )}
    </>
  );
}
