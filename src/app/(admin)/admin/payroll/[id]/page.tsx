import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

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
import { PayrollPeriodActions } from "@/components/admin/payroll-period-actions";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

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

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const periodId = Number(id);
  if (!Number.isInteger(periodId)) return { title: "Payroll" };

  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    select: { name: true },
  });
  return { title: period?.name ?? "Payroll" };
}

export default async function PayrollPeriodPage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const periodId = Number(id);
  // `/admin/payroll/components` is a sibling route — a non-numeric segment
  // here is a 404, never a period id.
  if (!Number.isInteger(periodId) || periodId <= 0) notFound();

  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, storeId: DEFAULT_STORE_ID },
    include: {
      processedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      details: {
        orderBy: { employee: { code: "asc" } },
        select: {
          id: true,
          basicSalary: true,
          workingDays: true,
          presentDays: true,
          absentDays: true,
          leaveDays: true,
          overtimeHours: true,
          overtimeAmount: true,
          grossEarnings: true,
          totalDeductions: true,
          netSalary: true,
          paymentMethod: true,
          paymentStatus: true,
          employee: {
            select: { id: true, code: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!period) notFound();

  const hasDetails = period.details.length > 0;

  return (
    <>
      <PageHeader
        title={period.name}
        description={`${dateLabel(period.startDate)} → ${dateLabel(period.endDate)} · pay date ${dateLabel(period.payDate)}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/payroll", label: "Payroll" },
        ]}
        actions={<StatusBadge status={period.status} tone={STATUS_TONES[period.status]} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Employees" value={String(period.details.length)} />
        <StatCard label="Gross" value={formatPrice(period.totalGross)} />
        <StatCard label="Deductions" value={formatPrice(period.totalDeductions)} />
        <StatCard label="Net payable" value={formatPrice(period.totalNet)} />
      </div>

      <Panel
        title="Actions"
        description={
          [
            period.processedBy && `Processed by ${period.processedBy.name}`,
            period.approvedBy && `Approved by ${period.approvedBy.name}`,
          ]
            .filter(Boolean)
            .join(" · ") || "Process the run to calculate every active employee's pay."
        }
      >
        <div className="p-5">
          <PayrollPeriodActions
            periodId={period.id}
            status={period.status}
            hasDetails={hasDetails}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Processing recalculates from scratch: existing lines are replaced, never
            duplicated. Overtime is paid at basic salary ÷ 208 hours per hour, and absent
            days are pro-rated out of the basic. Fridays are excluded from working days.
          </p>
        </div>
      </Panel>

      <div className="mt-6">
        <Panel title="Payslips">
          {!hasDetails ? (
            <EmptyState
              title="Not processed yet"
              description="Process this run to generate a line for every active employee."
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Employee</Th>
                <Th align="right">Basic</Th>
                <Th align="center">Days</Th>
                <Th align="right">Overtime</Th>
                <Th align="right">Gross</Th>
                <Th align="right">Deductions</Th>
                <Th align="right">Net</Th>
                <Th>Payment</Th>
                <Th>
                  <span className="sr-only">Payslip</span>
                </Th>
              </THead>
              <TBody>
                {period.details.map((d) => (
                  <tr key={d.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/employees/${d.employee.id}`}
                        className="link-wipe font-medium"
                      >
                        {[d.employee.firstName, d.employee.lastName]
                          .filter(Boolean)
                          .join(" ")}
                      </Link>
                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                        {d.employee.code}
                      </span>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(d.basicSalary)}
                    </Td>
                    <Td align="center" className="tabular-nums text-xs text-muted-foreground">
                      {d.presentDays}P / {d.absentDays}A / {d.leaveDays}L of {d.workingDays}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {toNumber(d.overtimeHours) > 0
                        ? `${toNumber(d.overtimeHours).toFixed(1)}h · ${formatPrice(d.overtimeAmount)}`
                        : "—"}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(d.grossEarnings)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(d.totalDeductions)}
                    </Td>
                    <Td align="right" className="font-medium tabular-nums">
                      {formatPrice(d.netSalary)}
                    </Td>
                    <Td>
                      <StatusBadge status={d.paymentStatus} />
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {d.paymentMethod.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/admin/payroll/${period.id}/payslip/${d.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <FileText className="size-3.5" strokeWidth={1.8} />
                        Payslip
                      </Link>
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>
      </div>
    </>
  );
}
