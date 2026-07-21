import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
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
import { EmployeeForm } from "@/components/admin/employee-form";
import { EmployeeSalaryStructure } from "@/components/admin/employee-salary-structure";
import { deleteEmployee } from "@/actions/admin/employees";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

/** `yyyy-mm-dd` for a `@db.Date` column stored at UTC midnight. */
function dateInput(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

/** `HH:MM` for a `@db.Time` column stored on the 1970 epoch day. */
function timeLabel(value: Date | null | undefined): string {
  if (!value) return "—";
  return `${String(value.getUTCHours()).padStart(2, "0")}:${String(
    value.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const employeeId = Number(id);
  if (!Number.isInteger(employeeId)) return { title: "Employee" };

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true },
  });
  return {
    title: employee
      ? [employee.firstName, employee.lastName].filter(Boolean).join(" ")
      : "Employee",
  };
}

export default async function EmployeeDetailPage({ params }: Props) {
  await requireStaff();

  const { id } = await params;
  const employeeId = Number(id);
  // `/admin/employees/departments` is a sibling route — anything non-numeric
  // that reaches this segment is a 404, not an employee.
  if (!Number.isInteger(employeeId) || employeeId <= 0) notFound();

  const [employee, departments, components] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: employeeId, storeId: DEFAULT_STORE_ID },
      include: {
        department: { select: { name: true } },
        salaryStructure: {
          orderBy: { effectiveFrom: "desc" },
          include: {
            component: {
              select: { name: true, type: true, calculationType: true },
            },
          },
        },
        attendance: {
          orderBy: { date: "desc" },
          take: 14,
          select: {
            id: true,
            date: true,
            status: true,
            checkIn: true,
            checkOut: true,
            workHours: true,
            overtimeHours: true,
          },
        },
        leaveRequests: {
          orderBy: { startDate: "desc" },
          take: 10,
          select: {
            id: true,
            startDate: true,
            endDate: true,
            days: true,
            status: true,
            reason: true,
            leaveType: { select: { name: true } },
          },
        },
      },
    }),
    prisma.department.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.salaryComponent.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, calculationType: true },
    }),
  ]);

  if (!employee) notFound();

  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  const photo = imageUrl(employee.photo);

  return (
    <>
      <PageHeader
        title={fullName}
        description={`${employee.code}${
          employee.designation ? ` · ${employee.designation}` : ""
        }${employee.department ? ` · ${employee.department.name}` : ""}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/employees", label: "Employees" },
        ]}
        actions={
          <DeleteButton
            id={employee.id}
            action={deleteEmployee}
            redirectTo="/admin/employees"
            label="Delete"
            confirmTitle="Delete this employee?"
            confirmBody="If they have attendance or payroll history the record is marked terminated instead, so the history stays intact."
          />
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={employee.status.replace(/_/g, " ")} />
        <StatCard label="Basic salary" value={formatPrice(employee.basicSalary)} />
        <StatCard label="Hired" value={dateInput(employee.hireDate) || "—"} />
        <StatCard
          label="Salary components"
          value={String(employee.salaryStructure.length)}
        />
      </div>

      <EmployeeForm
        values={{
          id: employee.id,
          code: employee.code,
          firstName: employee.firstName,
          lastName: employee.lastName ?? "",
          email: employee.email ?? "",
          phone: employee.phone ?? "",
          dateOfBirth: dateInput(employee.dateOfBirth),
          gender: employee.gender ?? "",
          nationalId: employee.nationalId ?? "",
          address: employee.address ?? "",
          city: employee.city ?? "",
          departmentId: employee.departmentId === null ? "" : String(employee.departmentId),
          designation: employee.designation ?? "",
          employmentType: employee.employmentType,
          hireDate: dateInput(employee.hireDate),
          terminationDate: dateInput(employee.terminationDate),
          basicSalary: String(toNumber(employee.basicSalary)),
          bankName: employee.bankName ?? "",
          bankAccount: employee.bankAccount ?? "",
          mobileBanking: employee.mobileBanking ?? "",
          emergencyContactName: employee.emergencyContactName ?? "",
          emergencyContactPhone: employee.emergencyContactPhone ?? "",
          status: employee.status,
          notes: employee.notes ?? "",
        }}
        departments={departments}
        photoUrl={photo}
      />

      <div className="mt-6 space-y-6">
        <EmployeeSalaryStructure
          employeeId={employee.id}
          components={components}
          rows={employee.salaryStructure.map((row) => ({
            id: row.id,
            componentName: row.component.name,
            componentType: row.component.type,
            calculationType: row.component.calculationType,
            amount: toNumber(row.amount),
            effectiveFrom: dateInput(row.effectiveFrom),
            effectiveTo: row.effectiveTo ? dateInput(row.effectiveTo) : null,
          }))}
        />

        <Panel title="Recent attendance" description="The last fortnight of records.">
          {employee.attendance.length === 0 ? (
            <EmptyState
              title="No attendance recorded"
              description="Mark this employee on the daily attendance sheet."
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th align="center">In</Th>
                <Th align="center">Out</Th>
                <Th align="right">Hours</Th>
                <Th align="right">Overtime</Th>
              </THead>
              <TBody>
                {employee.attendance.map((a) => (
                  <tr key={a.id}>
                    <Td className="tabular-nums">{dateInput(a.date)}</Td>
                    <Td>
                      <StatusBadge
                        label={a.status.replace(/_/g, " ").toLowerCase()}
                        tone={
                          a.status === "PRESENT"
                            ? "success"
                            : a.status === "ABSENT"
                              ? "danger"
                              : a.status === "LEAVE"
                                ? "info"
                                : a.status === "HOLIDAY"
                                  ? "neutral"
                                  : "warning"
                        }
                      />
                    </Td>
                    <Td align="center" className="tabular-nums">
                      {timeLabel(a.checkIn)}
                    </Td>
                    <Td align="center" className="tabular-nums">
                      {timeLabel(a.checkOut)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {toNumber(a.workHours).toFixed(2)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {toNumber(a.overtimeHours).toFixed(2)}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>

        <Panel title="Leave requests">
          {employee.leaveRequests.length === 0 ? (
            <EmptyState title="No leave requests" />
          ) : (
            <DataTable>
              <THead>
                <Th>Type</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th align="right">Days</Th>
                <Th>Status</Th>
                <Th>Reason</Th>
              </THead>
              <TBody>
                {employee.leaveRequests.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.leaveType.name}</Td>
                    <Td className="tabular-nums">{dateInput(l.startDate)}</Td>
                    <Td className="tabular-nums">{dateInput(l.endDate)}</Td>
                    <Td align="right" className="tabular-nums">
                      {l.days}
                    </Td>
                    <Td>
                      <StatusBadge status={l.status} />
                    </Td>
                    <Td className="text-muted-foreground">{l.reason ?? "—"}</Td>
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
