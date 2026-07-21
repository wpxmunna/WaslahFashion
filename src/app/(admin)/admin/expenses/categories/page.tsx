import { ExpenseCategoriesManager } from "@/components/admin/expense-categories-manager";
import { PageHeader } from "@/components/admin/ui";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Expense categories" };

export default async function ExpenseCategoriesPage() {
  const categories = await prisma.expenseCategory.findMany({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      color: true,
      icon: true,
      isActive: true,
      _count: { select: { expenses: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Expense categories"
        description="Group expenses so reports can break spending down."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/expenses", label: "Expenses" },
        ]}
      />

      <ExpenseCategoriesManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          color: c.color,
          icon: c.icon,
          isActive: c.isActive,
          expenseCount: c._count.expenses,
        }))}
      />
    </>
  );
}
