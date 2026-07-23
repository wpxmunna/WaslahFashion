import Link from "next/link";
import { format } from "date-fns";
import { Plus } from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { Pagination } from "@/components/pagination";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "Customers" };

const PER_PAGE = 20;

/** Cancelled and refunded orders are money that never landed. */
const REVENUE_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];

type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED";

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const active = first(raw.active);

  const where = {
    storeId: DEFAULT_STORE_ID,
    role: "CUSTOMER" as const,
    ...(active === "1" || active === "0" ? { isActive: active === "1" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const ids = customers.map((c) => c.id);

  // Legacy summed every order including cancelled and refunded ones, so the
  // customer screen disagreed with every revenue report in the app.
  const spendRows =
    ids.length === 0
      ? []
      : await prisma.order.groupBy({
          by: ["userId"],
          where: {
            storeId: DEFAULT_STORE_ID,
            userId: { in: ids },
            status: { in: REVENUE_STATUSES as OrderStatus[] },
          },
          _sum: { totalAmount: true },
        });

  const spend = new Map(
    spendRows.map((r) => [r.userId, toNumber(r._sum.totalAmount)]),
  );

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (active) query.set("active", active);

  const filtered = Boolean(q || active);

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${total} customer account${total === 1 ? "" : "s"}.`}
        actions={
          <Link href="/admin/customers/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            Add customer
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by name, email or phone"
            filters={[
              {
                name: "active",
                label: "Account state",
                options: [
                  { value: "", label: "All accounts" },
                  { value: "1", label: "Active" },
                  { value: "0", label: "Deactivated" },
                ],
              },
            ]}
          />
        </div>

        {customers.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching customers" : "No customers yet"}
            description={
              filtered
                ? "Try a different search or clear the filters."
                : "Accounts created in the shop will appear here."
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Customer</Th>
              <Th>Phone</Th>
              <Th>Joined</Th>
              <Th align="right">Orders</Th>
              <Th align="right">Lifetime spend</Th>
              <Th>State</Th>
            </THead>
            <TBody>
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="link-wipe block font-medium"
                    >
                      {c.name}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.email}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">{c.phone ?? "—"}</Td>
                  <Td className="text-muted-foreground">
                    {format(c.createdAt, "d MMM yyyy")}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {c._count.orders}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(spend.get(c.id) ?? 0)}
                  </Td>
                  <Td>
                    <StatusBadge status={c.isActive ? "ACTIVE" : "INACTIVE"} />
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
        basePath="/admin/customers"
      />
    </>
  );
}
