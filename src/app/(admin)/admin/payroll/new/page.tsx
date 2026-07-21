import { PageHeader } from "@/components/admin/ui";
import { PayrollPeriodForm } from "@/components/admin/payroll-period-form";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata = { title: "New payroll run" };

/** Default the form to the month just finished — the usual run to create. */
function defaults() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const pay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 7));

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monthName = start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  return {
    name: `${monthName} ${start.getUTCFullYear()} salary`,
    startDate: iso(start),
    endDate: iso(end),
    payDate: iso(pay),
  };
}

export default async function NewPayrollPeriodPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="New payroll run"
        description="Create the period first, then process it to calculate pay."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/payroll", label: "Payroll" },
        ]}
      />
      <PayrollPeriodForm defaults={defaults()} />
    </>
  );
}
