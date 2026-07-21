import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { PrintButton } from "@/components/admin/payroll-print-button";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/guard";
import { SITE, DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string; detailId: string }> };

function dateLabel(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "—";
}

export const metadata = { title: "Payslip" };

export default async function PayslipPage({ params }: Props) {
  await requireAdmin();

  const { id, detailId } = await params;
  const periodId = Number(id);
  const lineId = Number(detailId);
  if (!Number.isInteger(periodId) || !Number.isInteger(lineId)) notFound();

  const detail = await prisma.payrollDetail.findFirst({
    where: {
      id: lineId,
      payrollPeriodId: periodId,
      period: { storeId: DEFAULT_STORE_ID },
    },
    include: {
      period: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          payDate: true,
          status: true,
        },
      },
      employee: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          designation: true,
          bankName: true,
          bankAccount: true,
          mobileBanking: true,
          department: { select: { name: true } },
        },
      },
      components: {
        orderBy: [{ componentType: "asc" }, { componentName: "asc" }],
        select: {
          id: true,
          componentName: true,
          componentType: true,
          amount: true,
        },
      },
    },
  });

  if (!detail) notFound();

  const employeeName = [detail.employee.firstName, detail.employee.lastName]
    .filter(Boolean)
    .join(" ");

  const earnings = detail.components.filter((c) => c.componentType === "EARNING");
  const deductions = detail.components.filter((c) => c.componentType === "DEDUCTION");

  // The basic actually paid = gross less the earning components and overtime.
  // Displaying it derived keeps the payslip's earnings column summing exactly
  // to the stored gross, whatever rounding happened at processing time.
  const earningsTotal = earnings.reduce((s, c) => s + toNumber(c.amount), 0);
  const overtimeAmount = toNumber(detail.overtimeAmount);
  const paidBasic = toNumber(detail.grossEarnings) - earningsTotal - overtimeAmount;

  const rows: { label: string; amount: number }[] = [
    { label: "Basic salary (pro-rated)", amount: paidBasic },
    ...earnings.map((c) => ({ label: c.componentName, amount: toNumber(c.amount) })),
    ...(overtimeAmount > 0
      ? [
          {
            label: `Overtime (${toNumber(detail.overtimeHours).toFixed(2)} h)`,
            amount: overtimeAmount,
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Payslip"
          description={`${employeeName} · ${detail.period.name}`}
          breadcrumb={[
            { href: "/admin", label: "Dashboard" },
            { href: "/admin/payroll", label: "Payroll" },
            { href: `/admin/payroll/${detail.period.id}`, label: detail.period.name },
          ]}
          actions={
            <>
              <Link
                href={`/admin/payroll/${detail.period.id}`}
                className={buttonVariants({ variant: "outline" })}
              >
                Back to run
              </Link>
              <PrintButton />
            </>
          }
        />
      </div>

      <article className="mx-auto max-w-3xl">
        <Panel className="print:border-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
            <div>
              <p className="font-display text-2xl">{SITE.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Payslip · {detail.period.name}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">
                {dateLabel(detail.period.startDate)} → {dateLabel(detail.period.endDate)}
              </p>
              <p className="text-muted-foreground">
                Pay date {dateLabel(detail.period.payDate)}
              </p>
              <div className="mt-2 flex justify-end">
                <StatusBadge status={detail.paymentStatus} />
              </div>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-3 border-b border-border p-6 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Employee
              </dt>
              <dd className="mt-0.5 font-medium">{employeeName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Employee code
              </dt>
              <dd className="mt-0.5 font-mono">{detail.employee.code}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Department
              </dt>
              <dd className="mt-0.5">{detail.employee.department?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Designation
              </dt>
              <dd className="mt-0.5">{detail.employee.designation ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Payment method
              </dt>
              <dd className="mt-0.5 capitalize">
                {detail.paymentMethod.replace(/_/g, " ").toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Account
              </dt>
              <dd className="mt-0.5">
                {detail.employee.bankAccount
                  ? `${detail.employee.bankName ?? "Bank"} · ${detail.employee.bankAccount}`
                  : (detail.employee.mobileBanking ?? "—")}
              </dd>
            </div>
          </dl>

          <div className="border-b border-border p-6">
            <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
              Attendance
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
              {[
                ["Working days", detail.workingDays],
                ["Present", detail.presentDays],
                ["Absent", detail.absentDays],
                ["Leave", detail.leaveDays],
                ["Overtime h", toNumber(detail.overtimeHours).toFixed(2)],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-0.5 font-display text-lg tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <section>
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                Earnings
              </h2>
              <table className="mt-3 w-full text-sm">
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row" className="py-2 text-left font-normal">
                        {r.label}
                      </th>
                      <td className="py-2 text-right tabular-nums">
                        {formatPrice(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <th scope="row" className="py-2 text-left font-medium">
                      Gross earnings
                    </th>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatPrice(detail.grossEarnings)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            <section>
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                Deductions
              </h2>
              {deductions.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No deductions.</p>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {deductions.map((c) => (
                      <tr key={c.id}>
                        <th scope="row" className="py-2 text-left font-normal">
                          {c.componentName}
                        </th>
                        <td className="py-2 text-right tabular-nums">
                          {formatPrice(c.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <th scope="row" className="py-2 text-left font-medium">
                        Total deductions
                      </th>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {formatPrice(detail.totalDeductions)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border bg-secondary/40 p-6">
            <p className="font-display text-lg">Net pay</p>
            <p className="font-display text-2xl tabular-nums">
              {formatPrice(detail.netSalary)}
            </p>
          </div>

          <p className="p-6 pt-4 text-xs text-muted-foreground">
            Computer-generated payslip — no signature required. Overtime is paid at basic
            salary ÷ 208 hours. Absent days are deducted pro-rata from the basic salary;
            approved leave is paid in full.
          </p>
        </Panel>
      </article>
    </>
  );
}
