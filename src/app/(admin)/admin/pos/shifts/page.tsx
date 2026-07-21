import Link from "next/link";

import { AdminSearch } from "@/components/admin/admin-search";
import { PosDateRange } from "@/components/admin/pos-date-range";
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
import { buttonVariants } from "@/components/ui/button";
import type { Prisma } from "@/generated/prisma";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { endOfDay, parseDateInput } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "POS shifts" };

const PER_PAGE = 20;

export default async function PosShiftsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const status = first(raw.status);
  const from = parseDateInput(first(raw.from));
  const to = parseDateInput(first(raw.to));

  // Typed explicitly: the heterogeneous `OR` shapes below otherwise infer a
  // union with optional-undefined members that Prisma's input type rejects.
  const where: Prisma.PosShiftWhereInput = {
    storeId: DEFAULT_STORE_ID,
    ...(status === "OPEN" || status === "CLOSED" ? { status } : {}),
    ...(from || to
      ? {
          openingTime: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lt: endOfDay(to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { shiftNumber: { contains: q } },
            { user: { name: { contains: q } } },
            { terminal: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [shifts, total] = await Promise.all([
    prisma.posShift.findMany({
      where,
      orderBy: { openingTime: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        shiftNumber: true,
        openingTime: true,
        closingTime: true,
        totalSales: true,
        totalTransactions: true,
        cashDifference: true,
        status: true,
        user: { select: { name: true } },
        terminal: { select: { name: true } },
      },
    }),
    prisma.posShift.count({ where }),
  ]);

  const query = new URLSearchParams();
  for (const [key, value] of [
    ["q", q],
    ["status", status],
    ["from", first(raw.from)],
    ["to", first(raw.to)],
  ] as const) {
    if (value) query.set(key, value);
  }

  const filtered = Boolean(q || status || from || to);

  return (
    <>
      <PageHeader
        title="POS shifts"
        description={`${total} shift${total === 1 ? "" : "s"} match the current filters.`}
        breadcrumb={[
          { href: "/admin/pos", label: "POS" },
          { href: "/admin/pos/shifts", label: "Shifts" },
        ]}
      />

      <Panel>
        <div className="space-y-3 border-b border-border p-4">
          <AdminSearch
            placeholder="Search shift number, cashier or terminal"
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "OPEN", label: "Open" },
                  { value: "CLOSED", label: "Closed" },
                ],
              },
            ]}
          />
          <PosDateRange />
        </div>

        {shifts.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching shifts" : "No shifts yet"}
            description={
              filtered
                ? "Try a different search or clear the filters."
                : "Open a shift at the terminal to start trading."
            }
            action={
              <Link href="/admin/pos" className={buttonVariants()}>
                Open the terminal
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Shift</Th>
              <Th>Cashier</Th>
              <Th>Terminal</Th>
              <Th>Opened</Th>
              <Th>Closed</Th>
              <Th align="right">Sales</Th>
              <Th align="right">Difference</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {shifts.map((shift) => {
                const difference = toNumber(shift.cashDifference);
                return (
                  <tr key={shift.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/pos/shifts/${shift.id}`}
                        className="link-wipe font-medium"
                      >
                        {shift.shiftNumber}
                      </Link>
                    </Td>
                    <Td>{shift.user.name}</Td>
                    <Td className="text-muted-foreground">{shift.terminal.name}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {shift.openingTime.toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {shift.closingTime
                        ? shift.closingTime.toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(toNumber(shift.totalSales))}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {shift.totalTransactions} sale
                        {shift.totalTransactions === 1 ? "" : "s"}
                      </span>
                    </Td>
                    <Td align="right">
                      {shift.status === "CLOSED" ? (
                        <span
                          className={cn(
                            "tabular-nums",
                            difference !== 0 && "font-medium text-destructive",
                          )}
                        >
                          {difference > 0 ? "+" : ""}
                          {formatPrice(difference)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={shift.status} />
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </DataTable>
        )}
      </Panel>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        baseQuery={query.toString()}
        basePath="/admin/pos/shifts"
      />
    </>
  );
}
