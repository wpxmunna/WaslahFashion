import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteJournalEntry } from "@/actions/admin/accounting";
import { DeleteButton } from "@/components/admin/delete-button";
import { JournalEntryActions } from "@/components/admin/journal-actions";
import {
  DataTable,
  PageHeader,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "Journal entry" };

const STATUS_TONES = {
  DRAFT: "neutral",
  POSTED: "success",
  REVERSED: "warning",
} as const;

export default async function JournalEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  await requireAdmin();

  const { id } = await params;
  const raw = await searchParams;
  const entryId = Number(id);
  if (!Number.isInteger(entryId) || entryId <= 0) notFound();

  const entry = await prisma.journalEntry.findFirst({
    where: { id: entryId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      entryNumber: true,
      entryDate: true,
      description: true,
      referenceType: true,
      referenceId: true,
      totalDebit: true,
      totalCredit: true,
      status: true,
      notes: true,
      postedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      postedBy: { select: { name: true } },
      reversedBy: { select: { id: true, entryNumber: true } },
      reverses: { select: { id: true, entryNumber: true } },
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          description: true,
          debitAmount: true,
          creditAmount: true,
          account: {
            select: { id: true, code: true, name: true, type: true, normalBalance: true },
          },
        },
      },
    },
  });

  if (!entry) notFound();

  const created = raw.created === "1";
  const totalDebit = toNumber(entry.totalDebit);
  const totalCredit = toNumber(entry.totalCredit);

  const facts: { label: string; value: string }[] = [
    {
      label: "Entry date",
      value: entry.entryDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    },
    { label: "Reference", value: entry.referenceType.toLowerCase() },
    ...(entry.referenceId
      ? [{ label: "Reference id", value: String(entry.referenceId) }]
      : []),
    { label: "Created by", value: entry.createdBy?.name ?? "—" },
    {
      label: "Created",
      value: entry.createdAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    },
    ...(entry.postedAt
      ? [
          {
            label: "Posted",
            value: `${entry.postedAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}${entry.postedBy?.name ? ` by ${entry.postedBy.name}` : ""}`,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={entry.entryNumber}
        description={entry.description}
        breadcrumb={[
          { href: "/admin/accounting", label: "Accounting" },
          { href: "/admin/accounting/journal", label: "Journal" },
          { href: `/admin/accounting/journal/${entry.id}`, label: entry.entryNumber },
        ]}
        actions={
          <>
            <JournalEntryActions id={entry.id} status={entry.status} />
            {entry.status === "DRAFT" && (
              <DeleteButton
                id={entry.id}
                action={deleteJournalEntry}
                label="Delete draft"
                confirmTitle="Delete this draft?"
                confirmBody="The entry and its lines are removed. Only drafts can be deleted — a posted entry must be reversed."
                redirectTo="/admin/accounting/journal"
              />
            )}
          </>
        }
      />

      {created && (
        <p
          role="status"
          className="mb-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          Journal entry created.
        </p>
      )}

      {entry.status === "DRAFT" && (
        <p className="mb-6 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          This entry is a draft — it has not touched any account balance yet.
        </p>
      )}

      {entry.reversedBy && (
        <p className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Reversed by{" "}
          <Link
            href={`/admin/accounting/journal/${entry.reversedBy.id}`}
            className="link-wipe font-medium"
          >
            {entry.reversedBy.entryNumber}
          </Link>
          .
        </p>
      )}

      {entry.reverses.length > 0 && (
        <p className="mb-6 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          This entry reverses{" "}
          {entry.reverses.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link
                href={`/admin/accounting/journal/${r.id}`}
                className="link-wipe font-medium text-foreground"
              >
                {r.entryNumber}
              </Link>
            </span>
          ))}
          .
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel
          title="Lines"
          actions={<StatusBadge status={entry.status} tone={STATUS_TONES[entry.status]} />}
        >
          <DataTable>
            <THead>
              <Th>Account</Th>
              <Th>Description</Th>
              <Th align="right">Debit</Th>
              <Th align="right">Credit</Th>
            </THead>
            <TBody>
              {entry.lines.map((line) => (
                <tr key={line.id}>
                  <Td>
                    <span className="block">
                      <span className="tabular-nums text-muted-foreground">
                        {line.account.code}
                      </span>{" "}
                      {line.account.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground capitalize">
                      {line.account.type.toLowerCase()} ·{" "}
                      {line.account.normalBalance.toLowerCase()}-normal
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">{line.description ?? "—"}</Td>
                  <Td align="right" className="tabular-nums">
                    {toNumber(line.debitAmount) ? formatPrice(line.debitAmount) : "—"}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {toNumber(line.creditAmount) ? formatPrice(line.creditAmount) : "—"}
                  </Td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-secondary/40 font-medium">
                <td className="px-4 py-3 align-middle text-sm" colSpan={2}>
                  Total
                </td>
                <Td align="right" className="tabular-nums">
                  {formatPrice(totalDebit)}
                </Td>
                <Td align="right" className="tabular-nums">
                  {formatPrice(totalCredit)}
                </Td>
              </tr>
            </TBody>
          </DataTable>
        </Panel>

        <div className="space-y-6">
          <Panel title="Details">
            <dl className="divide-y divide-border">
              {facts.map((fact) => (
                <div key={fact.label} className="flex justify-between gap-3 px-5 py-3">
                  <dt className="text-sm text-muted-foreground">{fact.label}</dt>
                  <dd className="text-right text-sm capitalize">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {entry.notes && (
            <Panel title="Notes">
              <p className="whitespace-pre-wrap p-5 text-sm text-muted-foreground">
                {entry.notes}
              </p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
