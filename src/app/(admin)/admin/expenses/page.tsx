import Link from "next/link";
import { Plus, Tags } from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
import { ExpenseDateRange } from "@/components/admin/expense-date-range";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

const PER_PAGE = 20;

const PAYMENT_STATUSES = ["PENDING", "PARTIAL", "PAID"] as const;

export const metadata = { title: "Expenses" };

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function parseDateOnly(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const paymentStatus = first(raw.paymentStatus);
  const categoryRaw = Number(first(raw.category));
  const categoryId = Number.isInteger(categoryRaw) && categoryRaw > 0 ? categoryRaw : null;

  // Legacy defaulted the list to the current calendar month, which quietly hid
  // older expenses. An unset range here means "everything".
  let from = parseDateOnly(first(raw.from));
  let to = parseDateOnly(first(raw.to));
  if (from && to && from > to) [from, to] = [to, from];

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(paymentStatus && (PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)
      ? { paymentStatus: paymentStatus as (typeof PAYMENT_STATUSES)[number] }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(from || to
      ? { expenseDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { vendorName: { contains: q } },
            { expenseNumber: { contains: q } },
          ],
        }
      : {}),
  };

  const [expenses, total, sums, categories] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ expenseDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        expenseNumber: true,
        title: true,
        vendorName: true,
        totalAmount: true,
        expenseDate: true,
        paymentStatus: true,
        category: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.expense.count({ where }),
    // The total shown is for the *current filter*, not the whole store.
    prisma.expense.aggregate({ where, _sum: { totalAmount: true } }),
    prisma.expenseCategory.findMany({
      where: { storeId: DEFAULT_STORE_ID },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const paidSum = await prisma.expense.aggregate({
    where: { ...where, paymentStatus: "PAID" },
    _sum: { totalAmount: true },
  });

  const filteredTotal = toNumber(sums._sum.totalAmount);
  const filteredPaid = toNumber(paidSum._sum.totalAmount);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (paymentStatus) query.set("paymentStatus", paymentStatus);
  if (categoryId) query.set("category", String(categoryId));
  if (first(raw.from)) query.set("from", first(raw.from) as string);
  if (first(raw.to)) query.set("to", first(raw.to) as string);

  const filtered = Boolean(q || paymentStatus || categoryId || from || to);

  return (
    <>
      <PageHeader
        title="Expenses"
        description={`${total} expense${total === 1 ? "" : "s"} in this view.`}
        actions={
          <>
            <Link
              href="/admin/expenses/categories"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Tags className="size-4" strokeWidth={1.8} />
              Categories
            </Link>
            <Link href="/admin/expenses/new" className={cn(buttonVariants(), "gap-1.5")}>
              <Plus className="size-4" strokeWidth={2} />
              New expense
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total in view"
          value={formatPrice(filteredTotal)}
          hint="Matches the filters below."
        />
        <StatCard label="Paid" value={formatPrice(filteredPaid)} />
        <StatCard
          label="Unpaid"
          value={formatPrice(Math.max(0, filteredTotal - filteredPaid))}
        />
      </div>

      <Panel>
        <div className="space-y-3 border-b border-border p-4">
          <AdminSearch
            placeholder="Search by title, vendor or expense number"
            filters={[
              {
                name: "category",
                label: "Category",
                options: [
                  { value: "", label: "All categories" },
                  ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                ],
              },
              {
                name: "paymentStatus",
                label: "Payment status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "PENDING", label: "Pending" },
                  { value: "PARTIAL", label: "Partially paid" },
                  { value: "PAID", label: "Paid" },
                ],
              },
            ]}
          />
          <ExpenseDateRange />
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching expenses" : "No expenses yet"}
            description={
              filtered
                ? "Try a different search, date range or filter."
                : "Record your first expense to start tracking outgoings."
            }
            action={
              <Link href="/admin/expenses/new" className={buttonVariants()}>
                New expense
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Expense</Th>
              <Th>Category</Th>
              <Th>Date</Th>
              <Th>Vendor</Th>
              <Th align="right">Amount</Th>
              <Th>Payment</Th>
            </THead>
            <TBody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/expenses/${expense.id}`}
                      className="link-wipe block font-medium"
                    >
                      {expense.title}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {expense.expenseNumber}
                    </span>
                  </Td>
                  <Td>
                    {expense.category ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: expense.category.color }}
                        />
                        <span className="text-sm">{expense.category.name}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Uncategorised</span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">
                    {formatDate(expense.expenseDate)}
                  </Td>
                  <Td className="text-muted-foreground">{expense.vendorName ?? "—"}</Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(expense.totalAmount)}
                  </Td>
                  <Td>
                    <StatusBadge status={expense.paymentStatus} />
                  </Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        )}
      </Panel>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        baseQuery={query.toString()}
        basePath="/admin/expenses"
      />
    </>
  );
}
