import Link from "next/link";
import { ChartLine, Pin, Plus } from "lucide-react";

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
import { AdminSearch } from "@/components/admin/admin-search";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { CAMPAIGN_MESSAGE_TYPES, CAMPAIGN_PLATFORMS } from "@/components/admin/campaign-form-constants";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma";

export const metadata = { title: "Campaigns" };

const PER_PAGE = 20;

const PLATFORM_VALUES = [
  "ALL",
  "FACEBOOK",
  "INSTAGRAM",
  "WHATSAPP",
  "TELEGRAM",
  "TWITTER",
] as const;

const TYPE_VALUES = [
  "PROMOTION",
  "ANNOUNCEMENT",
  "GREETING",
  "OFFER",
  "EVENT",
  "CUSTOM",
] as const;

type PlatformValue = (typeof PLATFORM_VALUES)[number];
type TypeValue = (typeof TYPE_VALUES)[number];

function isPlatform(v: string | undefined): v is PlatformValue {
  return !!v && (PLATFORM_VALUES as readonly string[]).includes(v);
}

function isMessageType(v: string | undefined): v is TypeValue {
  return !!v && (TYPE_VALUES as readonly string[]).includes(v);
}

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const platform = first(raw.platform);
  const messageType = first(raw.type);

  const where: Prisma.CampaignWhereInput = {
    storeId: DEFAULT_STORE_ID,
    // A campaign set to ALL is relevant to every platform filter, matching
    // the legacy `platform = X OR platform = 'all'` rule.
    ...(isPlatform(platform) && platform !== "ALL"
      ? { platform: { in: [platform, "ALL"] } }
      : {}),
    ...(isMessageType(messageType) ? { messageType } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : {}),
  };

  const [campaigns, total, totals] = await Promise.all([
    prisma.campaign.findMany({
      where,
      // Pinned first, then newest — the only manual ordering lever campaigns have.
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        title: true,
        platform: true,
        messageType: true,
        isActive: true,
        isPinned: true,
        copyCount: true,
        totalViews: true,
        totalClicks: true,
      },
    }),
    prisma.campaign.count({ where }),
    prisma.campaign.aggregate({
      where: { storeId: DEFAULT_STORE_ID },
      _count: { _all: true },
      _sum: { copyCount: true, totalViews: true, totalClicks: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (platform) query.set("platform", platform);
  if (messageType) query.set("type", messageType);

  const label = (list: { value: string; label: string }[], value: string) =>
    list.find((x) => x.value === value)?.label ?? value;

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="The message library your team copies from when posting."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/social-media", label: "Social links" },
        ]}
        actions={
          <>
            <Link
              href="/admin/social-media/insights"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <ChartLine className="size-4" strokeWidth={1.8} />
              Insights
            </Link>
            <Link
              href="/admin/social-media/campaigns/new"
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <Plus className="size-4" strokeWidth={2} />
              New campaign
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaigns" value={totals._count._all.toLocaleString()} />
        <StatCard label="Views" value={(totals._sum.totalViews ?? 0).toLocaleString()} />
        <StatCard label="Clicks" value={(totals._sum.totalClicks ?? 0).toLocaleString()} />
        <StatCard label="Copies" value={(totals._sum.copyCount ?? 0).toLocaleString()} />
      </div>

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search title or content"
            filters={[
              {
                name: "platform",
                label: "Platform",
                options: [
                  { value: "", label: "All platforms" },
                  ...CAMPAIGN_PLATFORMS.filter((p) => p.value !== "ALL"),
                ],
              },
              {
                name: "type",
                label: "Message type",
                options: [{ value: "", label: "All types" }, ...CAMPAIGN_MESSAGE_TYPES],
              },
            ]}
          />
        </div>

        {campaigns.length === 0 ? (
          <EmptyState
            title={q || platform || messageType ? "No matching campaigns" : "No campaigns yet"}
            description={
              q || platform || messageType
                ? "Try a different search or clear the filters."
                : "Write the messages your team will post, once, and reuse them."
            }
            action={
              <Link href="/admin/social-media/campaigns/new" className={buttonVariants()}>
                New campaign
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Campaign</Th>
              <Th>Platform</Th>
              <Th>Type</Th>
              <Th align="right">Views</Th>
              <Th align="right">Clicks</Th>
              <Th align="right">Copies</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/40">
                  <Td>
                    <span className="flex items-center gap-2">
                      {c.isPinned && (
                        <Pin
                          className="size-3.5 shrink-0 text-amber-500"
                          strokeWidth={1.8}
                          aria-label="Pinned"
                        />
                      )}
                      <Link
                        href={`/admin/social-media/campaigns/${c.id}`}
                        className="link-wipe truncate font-medium"
                      >
                        {c.title}
                      </Link>
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">
                    {label(CAMPAIGN_PLATFORMS, c.platform)}
                  </Td>
                  <Td className="text-muted-foreground">
                    {label(CAMPAIGN_MESSAGE_TYPES, c.messageType)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {c.totalViews.toLocaleString()}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {c.totalClicks.toLocaleString()}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {c.copyCount.toLocaleString()}
                  </Td>
                  <Td>
                    <StatusBadge status={c.isActive ? "ACTIVE" : "INACTIVE"} />
                  </Td>
                </tr>
              ))}
            </TBody>
          </DataTable>
        )}
      </Panel>

      <Pagination
        page={page}
        totalPages={totalPages}
        baseQuery={query.toString()}
        basePath="/admin/social-media/campaigns"
      />
    </>
  );
}
