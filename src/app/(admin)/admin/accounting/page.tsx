import Link from "next/link";
import { BookOpen, Plus, Scale, Wallet } from "lucide-react";

import { AccountSeedButton } from "@/components/admin/account-seed-button";
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
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_TYPE_LABELS,
  getAccountSummary,
  getTrialBalance,
} from "@/lib/queries/reports";
import { cn } from "@/lib/utils";

export const metadata = { title: "Accounting" };

export default async function AccountingOverviewPage() {
  // Accounting is full-admin only, as in legacy. The layout gate only enforces
  // staff, so the stricter check has to live here.
  await requireAdmin();

  const storeId = DEFAULT_STORE_ID;

  const [summary, trial, recentEntries, counts] = await Promise.all([
    getAccountSummary(storeId),
    getTrialBalance(storeId),
    prisma.journalEntry.findMany({
      where: { storeId },
      orderBy: [{ entryDate: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        entryNumber: true,
        entryDate: true,
        description: true,
        totalDebit: true,
        status: true,
      },
    }),
    prisma.journalEntry.groupBy({
      by: ["status"],
      where: { storeId },
      _count: { _all: true },
    }),
  ]);

  const totalAccounts = summary.reduce((sum, s) => sum + s.accounts, 0);
  const byStatus = new Map(counts.map((c) => [c.status, c._count._all]));
  const drafts = byStatus.get("DRAFT") ?? 0;
  const posted = byStatus.get("POSTED") ?? 0;

  if (totalAccounts === 0) {
    return (
      <>
        <PageHeader
          title="Accounting"
          description="Chart of accounts, journal entries and the trial balance."
        />
        <Panel>
          <EmptyState
            title="No chart of accounts yet"
            description="Create the standard chart of accounts to start recording journal entries, or add accounts one at a time."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <AccountSeedButton />
                <Link
                  href="/admin/accounting/accounts"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Add manually
                </Link>
              </div>
            }
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Accounting"
        description="Chart of accounts, journal entries and the trial balance."
        actions={
          <>
            <Link
              href="/admin/accounting/accounts"
              className={buttonVariants({ variant: "outline" })}
            >
              Chart of accounts
            </Link>
            <Link
              href="/admin/accounting/journal/new"
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <Plus className="size-4" strokeWidth={2} />
              New journal entry
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accounts"
          value={String(totalAccounts)}
          hint="Active accounts in the chart"
          icon={<Wallet className="size-4" strokeWidth={1.7} />}
          href="/admin/accounting/accounts"
        />
        <StatCard
          label="Posted entries"
          value={String(posted)}
          hint={`${drafts} draft${drafts === 1 ? "" : "s"} awaiting review`}
          icon={<BookOpen className="size-4" strokeWidth={1.7} />}
          href="/admin/accounting/journal"
        />
        <StatCard
          label="Total debits"
          value={formatPrice(trial.totalDebit)}
          hint="Across all active accounts"
          icon={<Scale className="size-4" strokeWidth={1.7} />}
        />
        <StatCard
          label="Total credits"
          value={formatPrice(trial.totalCredit)}
          hint={trial.balanced ? "Trial balance ties out" : "Trial balance does not tie out"}
          icon={<Scale className="size-4" strokeWidth={1.7} />}
        />
      </div>

      {!trial.balanced && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          Debits and credits differ by{" "}
          {formatPrice(Math.abs(trial.totalDebit - trial.totalCredit))}. That normally
          means balances were changed outside the journal — every posted entry balances by
          construction.
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Balances by type" className="xl:col-span-1">
          <ul className="divide-y divide-border">
            {summary.map((s) => (
              <li key={s.type} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-sm">
                  {ACCOUNT_TYPE_LABELS[s.type]}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.accounts} account{s.accounts === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {formatPrice(s.balance)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Trial balance"
          description="Accounts with a non-zero balance"
          className="xl:col-span-2"
        >
          {trial.rows.length === 0 ? (
            <EmptyState
              title="Nothing posted yet"
              description="Account balances appear here once you post a journal entry."
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Code</Th>
                <Th>Account</Th>
                <Th align="right">Debit</Th>
                <Th align="right">Credit</Th>
              </THead>
              <TBody>
                {trial.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-secondary/40">
                    <Td className="tabular-nums text-muted-foreground">{row.code}</Td>
                    <Td>{row.name}</Td>
                    <Td align="right" className="tabular-nums">
                      {row.debit ? formatPrice(row.debit) : "—"}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {row.credit ? formatPrice(row.credit) : "—"}
                    </Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/40 font-medium">
                  <td className="px-4 py-3 align-middle text-sm" colSpan={2}>
                    Total
                  </td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(trial.totalDebit)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(trial.totalCredit)}
                  </Td>
                </tr>
              </TBody>
            </DataTable>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel
          title="Recent journal entries"
          actions={
            <Link href="/admin/accounting/journal" className="link-wipe text-sm">
              View all
            </Link>
          }
        >
          {recentEntries.length === 0 ? (
            <EmptyState
              title="No journal entries yet"
              action={
                <Link href="/admin/accounting/journal/new" className={buttonVariants()}>
                  New journal entry
                </Link>
              }
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Entry</Th>
                <Th>Description</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
              </THead>
              <TBody>
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/accounting/journal/${entry.id}`}
                        className="link-wipe tabular-nums"
                      >
                        {entry.entryNumber}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {entry.entryDate.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </Td>
                    <Td className="max-w-md truncate text-muted-foreground">
                      {entry.description}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(entry.totalDebit)}
                    </Td>
                    <Td>
                      <StatusBadge
                        status={entry.status}
                        tone={
                          entry.status === "POSTED"
                            ? "success"
                            : entry.status === "REVERSED"
                              ? "warning"
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
      </div>
    </>
  );
}
