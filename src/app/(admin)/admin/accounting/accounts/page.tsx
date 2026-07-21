import Link from "next/link";
import { Lock } from "lucide-react";

import { deleteAccount } from "@/actions/admin/accounting";
import { AccountFormDialog, type ParentOption } from "@/components/admin/account-form";
import { AccountSeedButton } from "@/components/admin/account-seed-button";
import { DeleteButton } from "@/components/admin/delete-button";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER } from "@/lib/queries/reports";

export const metadata = { title: "Chart of accounts" };

type Row = {
  id: number;
  code: string;
  name: string;
  type: string;
  parentId: number | null;
  description: string | null;
  normalBalance: "DEBIT" | "CREDIT";
  currentBalance: number;
  isActive: boolean;
  isSystem: boolean;
  lineCount: number;
  depth: number;
};

export default async function ChartOfAccountsPage() {
  await requireAdmin();

  const storeId = DEFAULT_STORE_ID;

  const accounts = await prisma.account.findMany({
    where: { storeId },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      parentId: true,
      description: true,
      normalBalance: true,
      currentBalance: true,
      isActive: true,
      isSystem: true,
      _count: { select: { lines: true } },
    },
  });

  const byId = new Map(accounts.map((a) => [a.id, a]));
  const childrenOf = new Map<number, typeof accounts>();
  for (const account of accounts) {
    if (account.parentId === null) continue;
    const list = childrenOf.get(account.parentId) ?? [];
    list.push(account);
    childrenOf.set(account.parentId, list);
  }

  /**
   * Depth-first walk within one account type. An account whose parent sits in a
   * different type is treated as a root of its own group, so it is never hidden
   * from the section it belongs to.
   */
  function walk(type: string): Row[] {
    const rows: Row[] = [];

    const visit = (account: (typeof accounts)[number], depth: number) => {
      rows.push({
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        parentId: account.parentId,
        description: account.description,
        normalBalance: account.normalBalance,
        currentBalance: toNumber(account.currentBalance),
        isActive: account.isActive,
        isSystem: account.isSystem,
        lineCount: account._count.lines,
        depth,
      });
      for (const child of childrenOf.get(account.id) ?? []) {
        if (child.type === type) visit(child, depth + 1);
      }
    };

    for (const account of accounts) {
      if (account.type !== type) continue;
      const parent = account.parentId ? byId.get(account.parentId) : undefined;
      if (!parent || parent.type !== type) visit(account, 0);
    }

    return rows;
  }

  const parentOptions: ParentOption[] = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
  }));

  const groups = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    label: ACCOUNT_TYPE_LABELS[type],
    rows: walk(type),
  })).filter((g) => g.rows.length > 0);

  return (
    <>
      <PageHeader
        title="Chart of accounts"
        description={`${accounts.length} account${accounts.length === 1 ? "" : "s"}, grouped by type.`}
        breadcrumb={[
          { href: "/admin/accounting", label: "Accounting" },
          { href: "/admin/accounting/accounts", label: "Chart of accounts" },
        ]}
        actions={
          <>
            {accounts.length === 0 && <AccountSeedButton />}
            <AccountFormDialog parents={parentOptions} />
          </>
        }
      />

      {accounts.length === 0 ? (
        <Panel>
          <EmptyState
            title="No accounts yet"
            description="Seed the standard chart of accounts, or add the accounts you need one at a time."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <AccountSeedButton />
                <Link
                  href="/admin/accounting"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Back to accounting
                </Link>
              </div>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const total = group.rows.reduce((sum, r) => sum + r.currentBalance, 0);
            return (
              <Panel
                key={group.type}
                title={group.label}
                description={`${group.rows.length} account${group.rows.length === 1 ? "" : "s"} · ${formatPrice(total)}`}
              >
                <DataTable>
                  <THead>
                    <Th>Code</Th>
                    <Th>Account</Th>
                    <Th>Normal balance</Th>
                    <Th align="right">Balance</Th>
                    <Th align="right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </THead>
                  <TBody>
                    {group.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-secondary/40">
                        <Td className="tabular-nums text-muted-foreground">{row.code}</Td>
                        <Td>
                          <span
                            className="flex items-center gap-2"
                            // Nesting depth reads as indentation; the tree is at
                            // most a few levels deep in practice.
                            style={{ paddingLeft: `${row.depth * 1.25}rem` }}
                          >
                            {row.depth > 0 && (
                              <span aria-hidden className="text-muted-foreground">
                                ↳
                              </span>
                            )}
                            <span className={row.isActive ? "" : "text-muted-foreground"}>
                              {row.name}
                            </span>
                            {row.isSystem && (
                              <span
                                title="System account"
                                className="inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
                              >
                                <Lock className="size-2.5" strokeWidth={2} />
                                System
                              </span>
                            )}
                            {!row.isActive && <StatusBadge status="INACTIVE" />}
                          </span>
                          {row.description && (
                            <span
                              className="mt-0.5 block text-xs text-muted-foreground"
                              style={{ paddingLeft: `${row.depth * 1.25}rem` }}
                            >
                              {row.description}
                            </span>
                          )}
                        </Td>
                        <Td className="text-muted-foreground capitalize">
                          {row.normalBalance.toLowerCase()}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {formatPrice(row.currentBalance)}
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end gap-1.5">
                            <AccountFormDialog
                              account={{
                                id: row.id,
                                code: row.code,
                                name: row.name,
                                type: row.type,
                                parentId: row.parentId,
                                description: row.description ?? "",
                                normalBalance: row.normalBalance,
                                isActive: row.isActive,
                                isSystem: row.isSystem,
                              }}
                              parents={parentOptions}
                              trigger={
                                <Button variant="outline" size="sm">
                                  Edit
                                </Button>
                              }
                            />
                            {!row.isSystem && (
                              <DeleteButton
                                id={row.id}
                                action={deleteAccount}
                                label="Delete"
                                confirmTitle={`Delete ${row.code} ${row.name}?`}
                                confirmBody={
                                  row.lineCount > 0
                                    ? "This account appears on journal entries, so it will be deactivated rather than deleted."
                                    : "This account has no journal activity and will be removed."
                                }
                              />
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
