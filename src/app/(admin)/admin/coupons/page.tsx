import Link from "next/link";
import { Plus } from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
import { CouponToggle } from "@/components/admin/coupon-toggle";
import {
  COUPON_TYPES,
  COUPON_TYPE_LABELS,
  type CouponType,
} from "@/components/admin/coupon-types";
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
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Coupons" };

const PER_PAGE = 20;

function isCouponType(v: string | undefined): v is CouponType {
  return v !== undefined && (COUPON_TYPES as string[]).includes(v);
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatWindow(startsAt: Date | null, expiresAt: Date | null): string {
  if (!startsAt && !expiresAt) return "Always";
  if (startsAt && !expiresAt) return `From ${dateFormat.format(startsAt)}`;
  if (!startsAt && expiresAt) return `Until ${dateFormat.format(expiresAt)}`;
  return `${dateFormat.format(startsAt as Date)} – ${dateFormat.format(expiresAt as Date)}`;
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const type = first(raw.type);
  const active = first(raw.active);

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(isCouponType(type) ? { type } : {}),
    ...(active === "1" ? { isActive: true } : {}),
    ...(active === "0" ? { isActive: false } : {}),
    // Codes are stored uppercase, so search on the uppercased needle.
    ...(q ? { code: { contains: q.toUpperCase() } } : {}),
  };

  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        code: true,
        type: true,
        value: true,
        maximumDiscount: true,
        minimumAmount: true,
        buyQuantity: true,
        getQuantity: true,
        usageLimit: true,
        usedCount: true,
        startsAt: true,
        expiresAt: true,
        isActive: true,
        giftProduct: { select: { name: true } },
      },
    }),
    prisma.coupon.count({ where }),
  ]);

  const now = new Date();

  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (type) query.set("type", type);
  if (active) query.set("active", active);

  const filtered = q !== "" || type !== undefined || active !== undefined;

  return (
    <>
      <PageHeader
        title="Coupons"
        description={`${total} coupon${total === 1 ? "" : "s"} in this store.`}
        actions={
          <Link href="/admin/coupons/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New coupon
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by code"
            filters={[
              {
                name: "type",
                label: "Type",
                options: [
                  { value: "", label: "All types" },
                  ...COUPON_TYPES.map((t) => ({
                    value: t,
                    label: COUPON_TYPE_LABELS[t],
                  })),
                ],
              },
              {
                name: "active",
                label: "State",
                options: [
                  { value: "", label: "Active and inactive" },
                  { value: "1", label: "Active only" },
                  { value: "0", label: "Inactive only" },
                ],
              },
            ]}
          />
        </div>

        {coupons.length === 0 ? (
          <EmptyState
            title={filtered ? "No matching coupons" : "No coupons yet"}
            description={
              filtered
                ? "Try a different search or clear the filters."
                : "Create a code to run your first promotion."
            }
            action={
              <Link href="/admin/coupons/new" className={buttonVariants()}>
                New coupon
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Code</Th>
              <Th>Type</Th>
              <Th>Reward</Th>
              <Th align="right">Usage</Th>
              <Th>Validity</Th>
              <Th>Status</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </THead>
            <TBody>
              {coupons.map((c) => {
                const value = toNumber(c.value);
                const cap = c.maximumDiscount ? toNumber(c.maximumDiscount) : null;

                const reward =
                  c.type === "FIXED"
                    ? formatPrice(value)
                    : c.type === "PERCENTAGE"
                      ? `${value}%${cap ? ` (max ${formatPrice(cap)})` : ""}`
                      : c.type === "FREE_SHIPPING"
                        ? "Delivery waived"
                        : c.type === "GIFT_ITEM"
                          ? (c.giftProduct?.name ?? "No gift selected")
                          : `Buy ${c.buyQuantity ?? "?"} get ${c.getQuantity ?? "?"}`;

                const expired = c.expiresAt !== null && c.expiresAt < now;
                const pending = c.startsAt !== null && c.startsAt > now;
                const usedUp =
                  c.usageLimit !== null && c.usedCount >= c.usageLimit;

                return (
                  <tr key={c.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/coupons/${c.id}`}
                        className="link-wipe font-medium tracking-wide"
                      >
                        {c.code}
                      </Link>
                      {toNumber(c.minimumAmount) > 0 && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Min spend {formatPrice(c.minimumAmount)}
                        </span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">
                      {COUPON_TYPE_LABELS[c.type]}
                    </Td>
                    <Td>{reward}</Td>
                    <Td align="right" className="tabular-nums">
                      {c.usedCount}
                      <span className="text-muted-foreground">
                        {" / "}
                        {c.usageLimit ?? "∞"}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatWindow(c.startsAt, c.expiresAt)}
                    </Td>
                    <Td>
                      {!c.isActive ? (
                        <StatusBadge status="INACTIVE" />
                      ) : expired ? (
                        <StatusBadge label="Expired" tone="danger" />
                      ) : pending ? (
                        <StatusBadge label="Scheduled" tone="info" />
                      ) : usedUp ? (
                        <StatusBadge label="Used up" tone="warning" />
                      ) : (
                        <StatusBadge status="ACTIVE" />
                      )}
                    </Td>
                    <Td align="right">
                      <CouponToggle id={c.id} code={c.code} isActive={c.isActive} />
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </DataTable>
        )}
      </Panel>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        baseQuery={query.toString()}
        basePath="/admin/coupons"
      />
    </>
  );
}
