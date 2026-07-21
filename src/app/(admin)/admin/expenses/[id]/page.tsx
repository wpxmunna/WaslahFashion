import { notFound } from "next/navigation";

import { deleteExpense } from "@/actions/admin/expenses";
import { DeleteButton } from "@/components/admin/delete-button";
import { ExpenseForm } from "@/components/admin/expense-form";
import { PageHeader } from "@/components/admin/ui";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id: Number(id) },
    select: { title: true },
  });
  return { title: expense?.title ?? "Expense" };
}

export default async function EditExpensePage({ params }: Props) {
  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isInteger(expenseId)) notFound();

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, storeId: DEFAULT_STORE_ID },
  });
  if (!expense) notFound();

  // An inactive category still has to appear, or saving would silently drop the
  // expense's existing category — a legacy bug.
  const categories = await prisma.expenseCategory.findMany({
    where: {
      storeId: DEFAULT_STORE_ID,
      OR: [
        { isActive: true },
        ...(expense.categoryId ? [{ id: expense.categoryId }] : []),
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  });

  return (
    <>
      <PageHeader
        title={expense.title}
        description={`${expense.expenseNumber} · recorded ${expense.createdAt.toLocaleDateString(
          "en-GB",
          { day: "numeric", month: "short", year: "numeric" },
        )}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/expenses", label: "Expenses" },
        ]}
        actions={
          <DeleteButton
            id={expense.id}
            action={deleteExpense}
            redirectTo="/admin/expenses"
            label="Delete"
            confirmTitle="Delete this expense?"
            confirmBody="This removes it from every expense report. It cannot be undone."
          />
        }
      />

      <ExpenseForm
        values={{
          id: expense.id,
          title: expense.title,
          categoryId: expense.categoryId,
          description: expense.description ?? "",
          amount: String(toNumber(expense.amount)),
          taxAmount: String(toNumber(expense.taxAmount)),
          expenseDate: expense.expenseDate.toISOString().slice(0, 10),
          paymentMethod: expense.paymentMethod,
          paymentStatus: expense.paymentStatus,
          referenceNumber: expense.referenceNumber ?? "",
          vendorName: expense.vendorName ?? "",
          notes: expense.notes ?? "",
          receiptUrl: expense.receiptPath ? imageUrl(expense.receiptPath) : null,
        }}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.isActive ? c.name : `${c.name} (inactive)`,
        }))}
      />
    </>
  );
}
