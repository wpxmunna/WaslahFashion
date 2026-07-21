import { ExpenseForm } from "@/components/admin/expense-form";
import { emptyExpenseValues } from "@/components/admin/expense-form-constants";
import { PageHeader } from "@/components/admin/ui";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "New expense" };

export default async function NewExpensePage() {
  const categories = await prisma.expenseCategory.findMany({
    where: { storeId: DEFAULT_STORE_ID, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageHeader
        title="New expense"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/expenses", label: "Expenses" },
        ]}
      />
      <ExpenseForm values={emptyExpenseValues} categories={categories} />
    </>
  );
}
