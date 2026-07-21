import { PageHeader } from "@/components/admin/ui";
import { CategoryForm } from "@/components/admin/category-form";
import { emptyCategoryValues } from "@/components/admin/category-form-constants";
import { parentOptions } from "@/components/admin/category-options";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "New category" };

export default async function NewCategoryPage() {
  const categories = await prisma.category.findMany({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, parentId: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="New category"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/categories", label: "Categories" },
        ]}
      />
      <CategoryForm values={emptyCategoryValues} parents={parentOptions(categories)} />
    </>
  );
}
