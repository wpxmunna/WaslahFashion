"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fieldErrors, type FormState } from "@/actions/types";
import { Prisma } from "@/generated/prisma";
import { requireAdmin } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { generateJournalNumber } from "@/lib/journal-number";
import { prisma } from "@/lib/prisma";

/* -------------------------------------------------------------------------
   Accounting is full-admin only — managers are locked out, as in the legacy
   `Session::get('admin_role') === 'admin'` check on both accounting screens.
   ------------------------------------------------------------------------- */

/** Thrown inside a transaction to abort it with a message we can show the user. */
class ActionError extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const ACCOUNT_TYPES = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
  "COGS",
] as const;

const REFERENCE_TYPES = [
  "MANUAL",
  "ORDER",
  "EXPENSE",
  "PURCHASE",
  "RETURN",
  "PAYMENT",
  "ADJUSTMENT",
] as const;

function parseCheckbox(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

/* =========================================================================
   Chart of accounts
   ========================================================================= */

const optionalId = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

const accountSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter an account code")
    .max(20, "Account codes are at most 20 characters")
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Use letters, digits, dot, dash or underscore"),
  name: z.string().trim().min(2, "Enter an account name").max(255),
  type: z.enum(ACCOUNT_TYPES),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  parentId: optionalId,
  description: z.string().trim().max(2000).optional(),
});

/* The normal balance is stored per account rather than derived from the type,
   so contra accounts (e.g. "Discounts Given" — REVENUE but debit-normal) work.
   Legacy stored the column but re-derived it from the type when posting, which
   made every contra account move the wrong way. */

/** Rejects a parent that is the account itself or one of its own descendants. */
async function parentIsCyclic(accountId: number, parentId: number): Promise<boolean> {
  let cursor: number | null = parentId;
  for (let depth = 0; cursor !== null && depth < 50; depth++) {
    if (cursor === accountId) return true;
    const parent: { parentId: number | null } | null = await prisma.account.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
  return false;
}

async function assertParent(
  parentId: number | null,
  storeId: number,
  selfId?: number,
): Promise<string | null> {
  if (parentId === null) return null;
  if (selfId !== undefined && parentId === selfId) {
    return "An account cannot be its own parent.";
  }
  const parent = await prisma.account.findFirst({
    where: { id: parentId, storeId },
    select: { id: true },
  });
  if (!parent) return "That parent account does not exist in this store.";
  if (selfId !== undefined && (await parentIsCyclic(selfId, parentId))) {
    return "That parent sits underneath this account, which would create a loop.";
  }
  return null;
}

export async function createAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const storeId = DEFAULT_STORE_ID;

  const clash = await prisma.account.findFirst({
    where: { storeId, code: d.code },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, errors: { code: ["That account code is already in use."] } };
  }

  const parentError = await assertParent(d.parentId, storeId);
  if (parentError) return { ok: false, errors: { parentId: [parentError] } };

  await prisma.account.create({
    data: {
      storeId,
      code: d.code,
      name: d.name,
      type: d.type,
      parentId: d.parentId,
      description: d.description || null,
      normalBalance: d.normalBalance,
      isActive: parseCheckbox(formData, "isActive"),
      isSystem: false,
    },
    select: { id: true },
  });

  revalidatePath("/admin/accounting/accounts");
  revalidatePath("/admin/accounting");
  return { ok: true, message: `Account ${d.code} created.` };
}

export async function updateAccount(
  id: number,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const d = parsed.data;
  const storeId = DEFAULT_STORE_ID;

  const existing = await prisma.account.findFirst({
    where: { id, storeId },
    select: { id: true, code: true, type: true, isSystem: true },
  });
  if (!existing) return { ok: false, message: "That account no longer exists." };

  // System accounts are referenced by automatic postings, so their identity is
  // frozen. Enforced here rather than trusting the disabled inputs on the form.
  if (existing.isSystem && (d.code !== existing.code || d.type !== existing.type)) {
    return {
      ok: false,
      message: "This is a system account — its code and type cannot be changed.",
    };
  }

  const code = existing.isSystem ? existing.code : d.code;
  const type = existing.isSystem ? existing.type : d.type;

  if (code !== existing.code) {
    const clash = await prisma.account.findFirst({
      where: { storeId, code, id: { not: id } },
      select: { id: true },
    });
    if (clash) {
      return { ok: false, errors: { code: ["That account code is already in use."] } };
    }
  }

  const parentError = await assertParent(d.parentId, storeId, id);
  if (parentError) return { ok: false, errors: { parentId: [parentError] } };

  await prisma.account.update({
    where: { id },
    data: {
      code,
      name: d.name,
      type,
      parentId: d.parentId,
      description: d.description || null,
      normalBalance: d.normalBalance,
      isActive: parseCheckbox(formData, "isActive"),
    },
  });

  revalidatePath("/admin/accounting/accounts");
  revalidatePath("/admin/accounting");
  return { ok: true, message: "Account saved." };
}

export async function deleteAccount(id: number): Promise<FormState> {
  await requireAdmin();

  const account = await prisma.account.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      code: true,
      isSystem: true,
      _count: { select: { lines: true, children: true } },
    },
  });
  if (!account) return { ok: false, message: "That account no longer exists." };

  if (account.isSystem) {
    return { ok: false, message: "System accounts cannot be deleted." };
  }

  // An account on a journal line is history; deactivate so the ledger keeps its
  // reference, exactly as `deleteProduct` archives products that appear on orders.
  if (account._count.lines > 0 || account._count.children > 0) {
    await prisma.account.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/accounting/accounts");
    revalidatePath("/admin/accounting");
    return {
      ok: true,
      message:
        account._count.lines > 0
          ? "This account appears on journal entries, so it was deactivated rather than deleted."
          : "This account has child accounts, so it was deactivated rather than deleted.",
    };
  }

  await prisma.account.delete({ where: { id } });
  revalidatePath("/admin/accounting/accounts");
  revalidatePath("/admin/accounting");
  return { ok: true, message: `Account ${account.code} deleted.` };
}

/**
 * Standard chart of accounts.
 *
 * Codes and names are kept identical to the legacy `10-erp.sql` seed so a
 * freshly seeded store and a store migrated from the PHP app line up. The one
 * deliberate change: 4200 "Discounts Given" keeps its debit normal balance and
 * our posting logic honours it, making it a real contra-revenue account. Legacy
 * stored DEBIT but then re-derived CREDIT from the account type when posting,
 * so discounts moved the wrong way.
 */
const STANDARD_ACCOUNTS: {
  code: string;
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  normalBalance: "DEBIT" | "CREDIT";
  description: string;
}[] = [
  { code: "1000", name: "Cash", type: "ASSET", normalBalance: "DEBIT", description: "Cash on hand" },
  { code: "1010", name: "Bank Account", type: "ASSET", normalBalance: "DEBIT", description: "Business bank accounts" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET", normalBalance: "DEBIT", description: "Money owed by customers" },
  { code: "1200", name: "Inventory", type: "ASSET", normalBalance: "DEBIT", description: "Product inventory value" },
  { code: "1300", name: "Prepaid Expenses", type: "ASSET", normalBalance: "DEBIT", description: "Advance payments" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", normalBalance: "CREDIT", description: "Money owed to suppliers" },
  { code: "2100", name: "Tax Payable", type: "LIABILITY", normalBalance: "CREDIT", description: "Taxes collected and owed" },
  { code: "2200", name: "Customer Deposits", type: "LIABILITY", normalBalance: "CREDIT", description: "Advance payments from customers" },
  { code: "3000", name: "Owner Equity", type: "EQUITY", normalBalance: "CREDIT", description: "Owner investment" },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", normalBalance: "CREDIT", description: "Accumulated profits" },
  { code: "4000", name: "Sales Revenue", type: "REVENUE", normalBalance: "CREDIT", description: "Product sales income" },
  { code: "4010", name: "Shipping Revenue", type: "REVENUE", normalBalance: "CREDIT", description: "Shipping fees collected" },
  { code: "4100", name: "Other Income", type: "REVENUE", normalBalance: "CREDIT", description: "Miscellaneous income" },
  { code: "4200", name: "Discounts Given", type: "REVENUE", normalBalance: "DEBIT", description: "Contra-revenue: sales discounts" },
  { code: "5000", name: "Cost of Goods Sold", type: "COGS", normalBalance: "DEBIT", description: "Direct cost of products sold" },
  { code: "5100", name: "Shipping Costs", type: "COGS", normalBalance: "DEBIT", description: "Outbound shipping costs" },
  { code: "6000", name: "Rent Expense", type: "EXPENSE", normalBalance: "DEBIT", description: "Office and warehouse rent" },
  { code: "6010", name: "Utilities Expense", type: "EXPENSE", normalBalance: "DEBIT", description: "Electricity, water, internet" },
  { code: "6020", name: "Salary Expense", type: "EXPENSE", normalBalance: "DEBIT", description: "Employee salaries" },
  { code: "6030", name: "Marketing Expense", type: "EXPENSE", normalBalance: "DEBIT", description: "Advertising and marketing" },
  { code: "6040", name: "Office Supplies", type: "EXPENSE", normalBalance: "DEBIT", description: "Office supplies and equipment" },
  { code: "6050", name: "Bank Fees", type: "EXPENSE", normalBalance: "DEBIT", description: "Bank charges and fees" },
  { code: "6060", name: "Insurance Expense", type: "EXPENSE", normalBalance: "DEBIT", description: "Business insurance" },
  { code: "6100", name: "Miscellaneous Expense", type: "EXPENSE", normalBalance: "DEBIT", description: "Other expenses" },
];

export async function seedChartOfAccounts(): Promise<FormState> {
  await requireAdmin();

  const storeId = DEFAULT_STORE_ID;

  const existing = await prisma.account.count({ where: { storeId } });
  if (existing > 0) {
    return {
      ok: false,
      message: `This store already has ${existing} account${existing === 1 ? "" : "s"}. Seeding is only available on an empty chart.`,
    };
  }

  await prisma.account.createMany({
    data: STANDARD_ACCOUNTS.map((a) => ({
      storeId,
      code: a.code,
      name: a.name,
      type: a.type,
      description: a.description,
      normalBalance: a.normalBalance,
      isSystem: true,
      isActive: true,
      currentBalance: 0,
    })),
  });

  revalidatePath("/admin/accounting/accounts");
  revalidatePath("/admin/accounting");
  return {
    ok: true,
    message: `Created ${STANDARD_ACCOUNTS.length} standard accounts.`,
  };
}

/* =========================================================================
   Journal entries
   ========================================================================= */

const entrySchema = z.object({
  entryDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  description: z.string().trim().min(3, "Describe what this entry records").max(1000),
  referenceType: z.enum(REFERENCE_TYPES).default("MANUAL"),
  referenceId: optionalId,
  notes: z.string().trim().max(2000).optional(),
});

type ParsedLine = {
  accountId: number;
  description: string | null;
  debit: number;
  credit: number;
};

type LineParseResult =
  | { ok: true; lines: ParsedLine[]; totalDebit: number; totalCredit: number }
  | { ok: false; message: string };

function amount(raw: FormDataEntryValue | undefined): number {
  const n = Number(String(raw ?? "").trim() || 0);
  return Number.isFinite(n) ? round2(n) : Number.NaN;
}

/**
 * Reads the dynamic line editor.
 *
 * The client posts four parallel repeated fields, so `getAll()` gives us the
 * rows in document order. Rows with no account and no amounts are dropped —
 * the editor always renders at least one spare row.
 */
function readLines(formData: FormData): LineParseResult {
  const accountIds = formData.getAll("lineAccountId");
  const descriptions = formData.getAll("lineDescription");
  const debits = formData.getAll("lineDebit");
  const credits = formData.getAll("lineCredit");

  const lines: ParsedLine[] = [];

  for (let i = 0; i < accountIds.length; i++) {
    const rawAccount = String(accountIds[i] ?? "").trim();
    const debit = amount(debits[i]);
    const credit = amount(credits[i]);

    if (!rawAccount && !debit && !credit) continue;

    if (Number.isNaN(debit) || Number.isNaN(credit)) {
      return { ok: false, message: `Line ${i + 1}: amounts must be numbers.` };
    }
    if (!rawAccount) {
      return { ok: false, message: `Line ${i + 1}: choose an account.` };
    }

    const accountId = Number(rawAccount);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return { ok: false, message: `Line ${i + 1}: that account is not valid.` };
    }
    if (debit < 0 || credit < 0) {
      return { ok: false, message: `Line ${i + 1}: amounts cannot be negative.` };
    }
    // Double entry: a line sits on one side of the ledger or the other, never both.
    if (debit > 0 && credit > 0) {
      return {
        ok: false,
        message: `Line ${i + 1}: enter either a debit or a credit, not both.`,
      };
    }
    if (debit === 0 && credit === 0) {
      return { ok: false, message: `Line ${i + 1}: enter a debit or a credit amount.` };
    }

    lines.push({
      accountId,
      description: String(descriptions[i] ?? "").trim().slice(0, 255) || null,
      debit,
      credit,
    });
  }

  if (lines.length < 2) {
    return { ok: false, message: "A journal entry needs at least two lines." };
  }

  const totalDebit = round2(lines.reduce((sum, l) => sum + l.debit, 0));
  const totalCredit = round2(lines.reduce((sum, l) => sum + l.credit, 0));

  if (totalDebit <= 0) {
    return { ok: false, message: "The entry total must be greater than zero." };
  }
  // Exact to the cent. Legacy allowed a 0.01 drift, which compounds silently.
  if (Math.abs(totalDebit - totalCredit) >= 0.005) {
    return {
      ok: false,
      message: `The entry does not balance — debits total ${totalDebit.toFixed(2)} but credits total ${totalCredit.toFixed(2)}.`,
    };
  }

  return { ok: true, lines, totalDebit, totalCredit };
}

/**
 * How a posted line moves an account's stored balance.
 *
 * A debit-normal account (assets, expenses, COGS, and contra-revenue accounts
 * such as "Discounts Given") grows on the debit side and shrinks on the credit
 * side; a credit-normal account does the opposite.
 */
function balanceDelta(
  normalBalance: "DEBIT" | "CREDIT",
  debit: number,
  credit: number,
): number {
  return normalBalance === "DEBIT" ? round2(debit - credit) : round2(credit - debit);
}

export async function createJournalEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();
  const storeId = DEFAULT_STORE_ID;

  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ...fieldErrors(z.flattenError(parsed.error).fieldErrors),
      message: "Please check the highlighted fields.",
    };
  }

  const lineResult = readLines(formData);
  if (!lineResult.ok) return { ok: false, message: lineResult.message };
  const { lines, totalDebit, totalCredit } = lineResult;

  // Never trust an account id from the client — every one must be an active
  // account of this store.
  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, storeId, isActive: true },
    select: { id: true },
  });
  if (accounts.length !== accountIds.length) {
    return {
      ok: false,
      message: "One of the selected accounts is not an active account of this store.",
    };
  }

  const d = parsed.data;
  const postNow = parseCheckbox(formData, "postNow");

  let entryId: number | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.journalEntry.create({
        data: {
          storeId,
          entryNumber: generateJournalNumber(),
          entryDate: new Date(`${d.entryDate}T00:00:00`),
          description: d.description,
          referenceType: d.referenceType,
          referenceId: d.referenceId,
          totalDebit,
          totalCredit,
          status: "DRAFT",
          notes: d.notes || null,
          createdById: user.id,
          lines: {
            create: lines.map((l) => ({
              accountId: l.accountId,
              description: l.description,
              debitAmount: l.debit,
              creditAmount: l.credit,
            })),
          },
        },
        select: { id: true },
      });
      entryId = created.id;
      break;
    } catch (error) {
      // Entry numbers carry 24 bits of randomness; retry the rare collision.
      if (isUniqueViolation(error) && attempt < 4) continue;
      throw error;
    }
  }

  if (entryId === null) {
    return { ok: false, message: "Could not allocate an entry number. Try again." };
  }

  if (postNow) {
    const posted = await applyPosting(entryId, storeId, user.id);
    if (!posted.ok) {
      revalidatePath("/admin/accounting/journal");
      return {
        ok: false,
        message: `${posted.message} The entry was saved as a draft.`,
      };
    }
  }

  revalidatePath("/admin/accounting/journal");
  revalidatePath("/admin/accounting");
  redirect(`/admin/accounting/journal/${entryId}?created=1`);
}

/** Shared DRAFT → POSTED transition, used by both the create form and the list. */
async function applyPosting(
  entryId: number,
  storeId: number,
  userId: number,
): Promise<FormState> {
  try {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findFirst({
        where: { id: entryId, storeId },
        select: {
          id: true,
          status: true,
          lines: {
            select: {
              accountId: true,
              debitAmount: true,
              creditAmount: true,
              account: { select: { normalBalance: true } },
            },
          },
        },
      });

      if (!entry) throw new ActionError("That entry no longer exists.");
      if (entry.status !== "DRAFT") {
        throw new ActionError("Only draft entries can be posted.");
      }

      // The conditional update is the real guard: two concurrent posts race
      // here and exactly one sees `count === 1`, so balances apply once.
      const claimed = await tx.journalEntry.updateMany({
        where: { id: entryId, status: "DRAFT" },
        data: { status: "POSTED", postedAt: new Date(), postedById: userId },
      });
      if (claimed.count === 0) {
        throw new ActionError("That entry has already been posted.");
      }

      for (const line of entry.lines) {
        const delta = balanceDelta(
          line.account.normalBalance,
          Number(line.debitAmount),
          Number(line.creditAmount),
        );
        if (delta === 0) continue;
        await tx.account.update({
          where: { id: line.accountId },
          data: { currentBalance: { increment: delta } },
        });
      }
    });
  } catch (error) {
    if (error instanceof ActionError) return { ok: false, message: error.message };
    throw error;
  }

  return { ok: true, message: "Entry posted." };
}

export async function postJournalEntry(id: number): Promise<FormState> {
  const user = await requireAdmin();

  const result = await applyPosting(id, DEFAULT_STORE_ID, user.id);

  revalidatePath("/admin/accounting/journal");
  revalidatePath(`/admin/accounting/journal/${id}`);
  revalidatePath("/admin/accounting/accounts");
  revalidatePath("/admin/accounting");
  return result;
}

/**
 * Reverses a posted entry by writing a mirrored, already-posted entry: every
 * debit becomes a credit and vice versa. Applying the mirror's own posting
 * effect exactly cancels the original's, so the two together are a no-op on
 * every account balance.
 *
 * Legacy never implemented this at all — the schema had `reversed_by_id` and a
 * `reversed` status with no code behind them.
 */
export async function reverseJournalEntry(id: number): Promise<FormState> {
  const user = await requireAdmin();
  const storeId = DEFAULT_STORE_ID;

  let reversalId: number | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      reversalId = await prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.findFirst({
          where: { id, storeId },
          select: {
            id: true,
            entryNumber: true,
            status: true,
            referenceType: true,
            referenceId: true,
            totalDebit: true,
            totalCredit: true,
            lines: {
              select: {
                accountId: true,
                description: true,
                debitAmount: true,
                creditAmount: true,
                account: { select: { normalBalance: true } },
              },
            },
          },
        });

        if (!entry) throw new ActionError("That entry no longer exists.");
        if (entry.status === "DRAFT") {
          throw new ActionError("A draft entry has not been posted, so delete it instead.");
        }
        if (entry.status === "REVERSED") {
          throw new ActionError("That entry has already been reversed.");
        }

        const claimed = await tx.journalEntry.updateMany({
          where: { id, status: "POSTED" },
          data: { status: "REVERSED" },
        });
        if (claimed.count === 0) {
          throw new ActionError("That entry has already been reversed.");
        }

        const reversal = await tx.journalEntry.create({
          data: {
            storeId,
            entryNumber: generateJournalNumber(),
            entryDate: new Date(),
            description: `Reversal of ${entry.entryNumber}`,
            referenceType: entry.referenceType,
            referenceId: entry.referenceId,
            // Swapped: the mirror's debits are the original's credits.
            totalDebit: entry.totalCredit,
            totalCredit: entry.totalDebit,
            status: "POSTED",
            postedAt: new Date(),
            postedById: user.id,
            createdById: user.id,
            notes: `Automatic reversal of journal entry ${entry.entryNumber}.`,
            lines: {
              create: entry.lines.map((l) => ({
                accountId: l.accountId,
                description: l.description,
                debitAmount: l.creditAmount,
                creditAmount: l.debitAmount,
              })),
            },
          },
          select: { id: true },
        });

        await tx.journalEntry.update({
          where: { id },
          data: { reversedById: reversal.id },
        });

        for (const line of entry.lines) {
          // Note the swap: debit and credit are passed the other way round.
          const delta = balanceDelta(
            line.account.normalBalance,
            Number(line.creditAmount),
            Number(line.debitAmount),
          );
          if (delta === 0) continue;
          await tx.account.update({
            where: { id: line.accountId },
            data: { currentBalance: { increment: delta } },
          });
        }

        return reversal.id;
      });
      break;
    } catch (error) {
      if (error instanceof ActionError) return { ok: false, message: error.message };
      if (isUniqueViolation(error) && attempt < 4) continue;
      throw error;
    }
  }

  revalidatePath("/admin/accounting/journal");
  revalidatePath(`/admin/accounting/journal/${id}`);
  if (reversalId) revalidatePath(`/admin/accounting/journal/${reversalId}`);
  revalidatePath("/admin/accounting/accounts");
  revalidatePath("/admin/accounting");

  return { ok: true, message: "Entry reversed." };
}

export async function deleteJournalEntry(id: number): Promise<FormState> {
  await requireAdmin();

  const entry = await prisma.journalEntry.findFirst({
    where: { id, storeId: DEFAULT_STORE_ID },
    select: { id: true, status: true, entryNumber: true },
  });
  if (!entry) return { ok: false, message: "That entry no longer exists." };

  // A posted entry has moved balances and is part of the audit trail; the only
  // correct way to undo it is a reversing entry.
  if (entry.status !== "DRAFT") {
    return {
      ok: false,
      message: "Posted entries cannot be deleted — reverse the entry instead.",
    };
  }

  // Lines cascade with the entry.
  await prisma.journalEntry.delete({ where: { id } });

  revalidatePath("/admin/accounting/journal");
  revalidatePath("/admin/accounting");
  return { ok: true, message: `Draft ${entry.entryNumber} deleted.` };
}
