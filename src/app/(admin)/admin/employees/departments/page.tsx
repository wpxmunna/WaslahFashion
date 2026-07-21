import { PageHeader } from "@/components/admin/ui";
import { DepartmentManager } from "@/components/admin/employee-departments";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  await requireStaff();

  const [departments, managers] = await Promise.all([
    prisma.department.findMany({
      where: { storeId: DEFAULT_STORE_ID },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        managerId: true,
        isActive: true,
        _count: { select: { employees: true } },
      },
    }),
    // Departments are managed by a staff user, not by an employee record.
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Departments"
        description={`${departments.length} department${
          departments.length === 1 ? "" : "s"
        }.`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/employees", label: "Employees" },
        ]}
      />

      <DepartmentManager
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code ?? "",
          description: d.description ?? "",
          managerId: d.managerId,
          isActive: d.isActive,
          employeeCount: d._count.employees,
        }))}
        managers={managers}
      />
    </>
  );
}
