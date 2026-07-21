import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";

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
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Payroll" };

const PER_PAGE = 20;

const STATUS_TONES = {
  DRAFT: "neutral",
  PROCESSING: "info",
  APPROVED: "success",
  PAID: "success",
  CANCELLED: "danger",
} as const;

function dateLabel(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "—";
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Payroll is full-admin only — managers never reach this screen.
  await requireAdmin();

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const where = { storeId: DEFAULT_STORE_ID };

  const [periods, total] = await Promise.all([
    prisma.payrollPeriod.findMany({
      where,
      orderBy: { startDate: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        payDate: true,
        status: true,
        totalEmployees: true,
        totalGross: true,
        totalDeductions: true,
        totalNet: true,
        _count: { select: { details: true } },
      },
    }),
    prisma.payrollPeriod.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Payroll"
        description={`${total} payroll run${total === 1 ? "" : "s"}.`}
        actions={
          <>
            <Link
              href="/admin/payroll/components"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <SlidersHorizontal className="size-4" strokeWidth={1.8} />
              Components
            </Link>
            <Link href="/admin/payroll/new" className={cn(buttonVariants(), "gap-1.5")}>
              <Plus className="size-4" strokeWidth={2} />
              New run
            </Link>
          </>
        }
      />

      <Panel>
        {periods.length === 0 ? (
          <EmptyState
            title="No payroll runs yet"
            description="Create a period, then process it to calculate every employee's pay."
            action={
              <Link href="/admin/payroll/new" className={buttonVariants()}>
                New run
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Period</Th>
              <Th>Dates</Th>
              <Th>Pay date</Th>
              <Th align="right">Employees</Th>
              <Th align="right">Gross</Th>
              <Th align="right">Deductions</Th>
              <Th align="right">Net</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link href={`/admin/payroll/${p.id}`} className="link-wipe font-medium">
                      {p.name}
                    </Link>
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {dateLabel(p.startDate)} → {dateLabel(p.endDate)}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {dateLabel(p.payDate)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {p._count.details || p.totalEmployees}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(p.totalGross)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(p.totalDeductions)}
                  </Td>
                  <Td align="right" className="font-medium tabular-nums">
                    {formatPrice(p.totalNet)}
                  </Td>
                  <Td>
                    <StatusBadge status={p.status} tone={STATUS_TONES[p.status]} />
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
        basePath="/admin/payroll"
      />
    </>
  );
}
