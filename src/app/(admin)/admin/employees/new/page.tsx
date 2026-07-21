import { PageHeader } from "@/components/admin/ui";
import { EmployeeForm } from "@/components/admin/employee-form";
import { emptyEmployeeValues } from "@/components/admin/employee-form-constants";
import { nextEmployeeCode } from "@/actions/admin/employees";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "New employee" };

export default async function NewEmployeePage() {
  await requireStaff();

  const [departments, code] = await Promise.all([
    prisma.department.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    nextEmployeeCode(),
  ]);

  return (
    <>
      <PageHeader
        title="New employee"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/employees", label: "Employees" },
        ]}
      />
      <EmployeeForm
        values={{
          ...emptyEmployeeValues,
          code,
          hireDate: new Date().toISOString().slice(0, 10),
        }}
        departments={departments}
      />
    </>
  );
}
