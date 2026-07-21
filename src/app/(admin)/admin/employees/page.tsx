import Link from "next/link";
import { Building2, Plus } from "lucide-react";

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
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Employees" };

const PER_PAGE = 20;

const STATUSES = ["ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"] as const;
type EmployeeStatus = (typeof STATUSES)[number];

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full time",
  PART_TIME: "Part time",
  CONTRACT: "Contract",
  INTERN: "Intern",
};

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireStaff();

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const status = first(raw.status);
  const departmentRaw = Number(first(raw.department));
  const departmentId =
    Number.isInteger(departmentRaw) && departmentRaw > 0 ? departmentRaw : undefined;

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(status && (STATUSES as readonly string[]).includes(status)
      ? { status: status as EmployeeStatus }
      : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { code: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };

  const [employees, total, departments] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: [{ status: "asc" }, { code: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        designation: true,
        employmentType: true,
        hireDate: true,
        status: true,
        department: { select: { name: true } },
      },
    }),
    prisma.employee.count({ where }),
    prisma.department.findMany({
      where: { storeId: DEFAULT_STORE_ID },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (departmentId) query.set("department", String(departmentId));

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${total} employee${total === 1 ? "" : "s"} on record.`}
        actions={
          <>
            <Link
              href="/admin/employees/departments"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Building2 className="size-4" strokeWidth={1.8} />
              Departments
            </Link>
            <Link href="/admin/employees/new" className={cn(buttonVariants(), "gap-1.5")}>
              <Plus className="size-4" strokeWidth={2} />
              New employee
            </Link>
          </>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by name, code, phone or email"
            filters={[
              {
                name: "department",
                label: "Department",
                options: [
                  { value: "", label: "All departments" },
                  ...departments.map((d) => ({ value: String(d.id), label: d.name })),
                ],
              },
              {
                name: "status",
                label: "Status",
                options: [
                  { value: "", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "ON_LEAVE", label: "On leave" },
                  { value: "TERMINATED", label: "Terminated" },
                  { value: "RESIGNED", label: "Resigned" },
                ],
              },
            ]}
          />
        </div>

        {employees.length === 0 ? (
          <EmptyState
            title={q || status || departmentId ? "No matching employees" : "No employees yet"}
            description={
              q || status || departmentId
                ? "Try a different search or clear the filters."
                : "Add your first employee to start tracking attendance and payroll."
            }
            action={
              <Link href="/admin/employees/new" className={buttonVariants()}>
                New employee
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Department</Th>
              <Th>Designation</Th>
              <Th>Type</Th>
              <Th>Hired</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-secondary/40">
                  <Td className="font-mono text-xs">{e.code}</Td>
                  <Td>
                    <Link
                      href={`/admin/employees/${e.id}`}
                      className="link-wipe font-medium"
                    >
                      {[e.firstName, e.lastName].filter(Boolean).join(" ")}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{e.department?.name ?? "—"}</Td>
                  <Td className="text-muted-foreground">{e.designation ?? "—"}</Td>
                  <Td className="text-muted-foreground">
                    {EMPLOYMENT_LABELS[e.employmentType] ?? e.employmentType}
                  </Td>
                  <Td className="tabular-nums text-muted-foreground">
                    {formatDate(e.hireDate)}
                  </Td>
                  <Td>
                    <StatusBadge
                      status={e.status}
                      tone={
                        e.status === "ACTIVE"
                          ? "success"
                          : e.status === "ON_LEAVE"
                            ? "info"
                            : "neutral"
                      }
                    />
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
        baseQuery={query.toString()}
        basePath="/admin/employees"
      />
    </>
  );
}
