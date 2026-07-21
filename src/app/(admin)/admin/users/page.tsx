import Link from "next/link";
import { Plus } from "lucide-react";

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
import { AdminSearch } from "@/components/admin/admin-search";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Staff" };

const PER_PAGE = 20;

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const current = await requireAdmin();

  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const role = first(raw.role);

  const where = {
    // Customers are managed elsewhere; this screen is staff only.
    role:
      role === "ADMIN" || role === "MANAGER"
        ? (role as "ADMIN" | "MANAGER")
        : { in: ["ADMIN", "MANAGER"] as ("ADMIN" | "MANAGER")[] },
    ...(q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : {}),
  };

  const [staff, total, activeAdmins] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
  ]);

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (role) query.set("role", role);

  return (
    <>
      <PageHeader
        title="Staff"
        description={`${total} staff account${
          total === 1 ? "" : "s"
        } · ${activeAdmins} active administrator${activeAdmins === 1 ? "" : "s"}.`}
        actions={
          <Link href="/admin/users/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New staff member
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by name or email"
            filters={[
              {
                name: "role",
                label: "Role",
                options: [
                  { value: "", label: "All roles" },
                  { value: "ADMIN", label: "Administrators" },
                  { value: "MANAGER", label: "Managers" },
                ],
              },
            ]}
          />
        </div>

        {staff.length === 0 ? (
          <EmptyState
            title={q || role ? "No matching staff" : "No staff accounts yet"}
            description={
              q || role
                ? "Try a different search or clear the filters."
                : "Add an administrator or manager to give someone panel access."
            }
            action={
              <Link href="/admin/users/new" className={buttonVariants()}>
                New staff member
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Last login</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {staff.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/40">
                  <Td>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="link-wipe block font-medium"
                    >
                      {u.name}
                      {u.id === current.id && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                      )}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {u.email}
                      {u.phone && ` · ${u.phone}`}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge
                      label={u.role === "ADMIN" ? "Administrator" : "Manager"}
                      tone={u.role === "ADMIN" ? "accent" : "neutral"}
                    />
                  </Td>
                  <Td className="text-muted-foreground">
                    {u.lastLoginAt ? dateTime.format(u.lastLoginAt) : "Never"}
                  </Td>
                  <Td>
                    <StatusBadge status={u.isActive ? "ACTIVE" : "INACTIVE"} />
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
        basePath="/admin/users"
      />
    </>
  );
}
