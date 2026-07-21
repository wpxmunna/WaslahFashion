import Link from "next/link";

import { AccountSeedButton } from "@/components/admin/account-seed-button";
import { JournalEntryForm } from "@/components/admin/journal-entry-form";
import { EmptyState, PageHeader, Panel } from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_TYPE_ORDER } from "@/lib/queries/reports";

export const metadata = { title: "New journal entry" };

export default async function NewJournalEntryPage() {
  await requireAdmin();

  const accounts = await prisma.account.findMany({
    where: { storeId: DEFAULT_STORE_ID, isActive: true },
    orderBy: [{ code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  });

  // Order the picker the way a chart of accounts reads, not alphabetically.
  const ordered = [...accounts].sort(
    (a, b) =>
      ACCOUNT_TYPE_ORDER.indexOf(a.type as (typeof ACCOUNT_TYPE_ORDER)[number]) -
        ACCOUNT_TYPE_ORDER.indexOf(b.type as (typeof ACCOUNT_TYPE_ORDER)[number]) ||
      a.code.localeCompare(b.code),
  );

  return (
    <>
      <PageHeader
        title="New journal entry"
        description="Debits must equal credits, and the total must be greater than zero."
        breadcrumb={[
          { href: "/admin/accounting", label: "Accounting" },
          { href: "/admin/accounting/journal", label: "Journal" },
          { href: "/admin/accounting/journal/new", label: "New entry" },
        ]}
      />

      {ordered.length < 2 ? (
        <Panel>
          <EmptyState
            title="You need accounts before you can post"
            description="A double-entry line needs an account on each side. Seed the standard chart of accounts, or add your own."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <AccountSeedButton />
                <Link
                  href="/admin/accounting/accounts"
                  className={buttonVariants({ variant: "outline" })}
                >
                  Chart of accounts
                </Link>
              </div>
            }
          />
        </Panel>
      ) : (
        <JournalEntryForm accounts={ordered} />
      )}
    </>
  );
}
