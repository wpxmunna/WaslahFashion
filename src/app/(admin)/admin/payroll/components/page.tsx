import { PageHeader } from "@/components/admin/ui";
import { SalaryComponentManager } from "@/components/admin/payroll-components";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Salary components" };

export default async function SalaryComponentsPage() {
  await requireAdmin();

  const components = await prisma.salaryComponent.findMany({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      calculationType: true,
      defaultAmount: true,
      percentageOf: true,
      isTaxable: true,
      isActive: true,
      _count: { select: { employeeSalaries: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Salary components"
        description="Allowances and deductions available to every employee's salary structure."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/payroll", label: "Payroll" },
        ]}
      />

      <SalaryComponentManager
        components={components.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          calculationType: c.calculationType,
          defaultAmount: String(toNumber(c.defaultAmount)),
          percentageOf: c.percentageOf ?? "",
          isTaxable: c.isTaxable,
          isActive: c.isActive,
          usageCount: c._count.employeeSalaries,
        }))}
      />
    </>
  );
}
