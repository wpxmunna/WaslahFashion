import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
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
import { ReportDateRange } from "@/components/admin/report-date-range";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { parseDateRange } from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Journal entries" };

const PER_PAGE = 20;
const STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const;

const STATUS_TONES = {
  DRAFT: "neutral",
  POSTED: "success",
  REVERSED: "warning",
} as const;

export default async function JournalListPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAdmin();

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const statusRaw = first(raw.status);
  const status = STATUSES.includes(statusRaw as (typeof STATUSES)[number])
    ? (statusRaw as (typeof STATUSES)[number])
    : undefined;

  // The date filter shares the reports' range control, so it defaults to the
  // current month rather than showing the whole ledger by accident.
  const range = parseDateRange(raw);

  const where = {
    storeId: DEFAULT_STORE_ID,
    entryDate: { gte: range.start, lte: range.end },
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { entryNumber: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
  };

  const [entries, total, totals] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        entryNumber: true,
        entryDate: true,
        description: true,
        referenceType: true,
        totalDebit: true,
        totalCredit: true,
        status: true,
        createdBy: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.aggregate({
      where,
      _sum: { totalDebit: true, totalCredit: true },
    }),
  ]);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  query.set("start", range.startKey);
  query.set("end", range.endKey);

  return (
    <>
      <PageHeader
        title="Journal entries"
        description={`${total} entr${total === 1 ? "y" : "ies"} between ${range.startKey} and ${range.endKey}.`}
        breadcrumb={[
          { href: "/admin/accounting", label: "Accounting" },
          { href: "/admin/accounting/journal", label: "Journal" },
        ]}
        actions={
          <Link
            href="/admin/accounting/journal/new"
            className={cn(buttonVariants(), "gap-1.5")}
          >
            <Plus className="size-4" strokeWidth={2} />
            New entry
          </Link>
        }
      />

      <Panel>
        <ReportDateRange start={range.startKey} end={range.endKey} />

        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by entry number or description"
            filters={[
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "POSTED", label: "Posted" },
                  { value: "REVERSED", label: "Reversed" },
                ],
              },
            ]}
          />
        </div>

        {entries.length === 0 ? (
          <EmptyState
            title={q || status ? "No matching entries" : "No entries in this range"}
            description={
              q || status
                ? "Try a different search, or widen the date range."
                : "Widen the date range, or record your first journal entry."
            }
            action={
              <Link href="/admin/accounting/journal/new" className={buttonVariants()}>
                New entry
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Entry</Th>
              <Th>Description</Th>
              <Th>Reference</Th>
              <Th align="right">Debit</Th>
              <Th align="right">Credit</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/accounting/journal/${entry.id}`}
                      className="link-wipe block tabular-nums"
                    >
                      {entry.entryNumber}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {entry.entryDate.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {entry.createdBy?.name && ` · ${entry.createdBy.name}`}
                    </span>
                  </Td>
                  <Td className="max-w-sm">
                    <span className="block truncate">{entry.description}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {entry._count.lines} line{entry._count.lines === 1 ? "" : "s"}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground capitalize">
                    {entry.referenceType.toLowerCase()}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(entry.totalDebit)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(entry.totalCredit)}
                  </Td>
                  <Td>
                    <StatusBadge status={entry.status} tone={STATUS_TONES[entry.status]} />
                  </Td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-secondary/40 font-medium">
                <td className="px-4 py-3 align-middle text-sm" colSpan={3}>
                  Total across {total} entr{total === 1 ? "y" : "ies"}
                </td>
                <Td align="right" className="tabular-nums">
                  {formatPrice(totals._sum.totalDebit)}
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatPrice(totals._sum.totalCredit)}
                </Td>
                <Td />
              </tr>
            </TBody>
          </DataTable>
        )}
      </Panel>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        baseQuery={query.toString()}
        basePath="/admin/accounting/journal"
      />
    </>
  );
}
