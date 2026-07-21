import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { CampaignTrend, type TrendPoint } from "@/components/admin/campaign-trend";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata = { title: "Campaign insights" };

const WINDOW_DAYS = 14;

/** Midnight UTC for a date `daysAgo` back, matching the `@db.Date` columns. */
function utcDay(daysAgo: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo),
  );
}

export default async function CampaignInsightsPage() {
  const since = utcDay(WINDOW_DAYS - 1);

  const [totals, topByViews, topByCopies, daily] = await Promise.all([
    prisma.campaign.aggregate({
      where: { storeId: DEFAULT_STORE_ID },
      _count: { _all: true },
      _sum: {
        totalViews: true,
        totalClicks: true,
        totalShares: true,
        totalEngagements: true,
        copyCount: true,
      },
    }),
    prisma.campaign.findMany({
      // Unlike legacy, inactive campaigns are included — otherwise the leaderboard
      // does not reconcile with the totals above it.
      where: { storeId: DEFAULT_STORE_ID },
      orderBy: { totalViews: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        platform: true,
        isActive: true,
        totalViews: true,
        totalClicks: true,
        conversionRate: true,
      },
    }),
    prisma.campaign.findMany({
      where: { storeId: DEFAULT_STORE_ID, copyCount: { gt: 0 } },
      orderBy: { copyCount: "desc" },
      take: 5,
      select: { id: true, title: true, copyCount: true },
    }),
    prisma.campaignDailyStat.groupBy({
      by: ["date"],
      where: { campaign: { storeId: DEFAULT_STORE_ID }, date: { gte: since } },
      _sum: { views: true, clicks: true, copies: true, shares: true, uniqueViews: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const key = (d: Date) => d.toISOString().slice(0, 10);
  const byDate = new Map(daily.map((row) => [key(row.date), row._sum]));

  // Days with no events have no row; fill them so the chart keeps a real time axis.
  const series: (TrendPoint & {
    copies: number;
    shares: number;
    uniqueViews: number;
  })[] = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = utcDay(WINDOW_DAYS - 1 - i);
    const sums = byDate.get(key(date));
    return {
      date: key(date),
      views: sums?.views ?? 0,
      clicks: sums?.clicks ?? 0,
      copies: sums?.copies ?? 0,
      shares: sums?.shares ?? 0,
      uniqueViews: sums?.uniqueViews ?? 0,
    };
  });

  const sum = totals._sum;
  const allViews = sum.totalViews ?? 0;
  const allClicks = sum.totalClicks ?? 0;

  // Computed from the totals rather than averaging per-campaign rates, which
  // legacy did and which over-weights low-traffic campaigns.
  const conversion = allViews > 0 ? (allClicks / allViews) * 100 : 0;

  const hasData = totals._count._all > 0;

  return (
    <>
      <PageHeader
        title="Campaign insights"
        description="Aggregate performance across every campaign in the library."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/social-media", label: "Social links" },
          { href: "/admin/social-media/campaigns", label: "Campaigns" },
        ]}
        actions={
          <Link
            href="/admin/social-media/campaigns"
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            Back to campaigns
          </Link>
        }
      />

      {!hasData ? (
        <Panel>
          <EmptyState
            title="No campaigns yet"
            description="Insights appear once you have campaigns collecting views and copies."
            action={
              <Link href="/admin/social-media/campaigns/new" className={buttonVariants()}>
                New campaign
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Views" value={allViews.toLocaleString()} />
            <StatCard label="Clicks" value={allClicks.toLocaleString()} />
            <StatCard label="Shares" value={(sum.totalShares ?? 0).toLocaleString()} />
            <StatCard label="Copies" value={(sum.copyCount ?? 0).toLocaleString()} />
            <StatCard
              label="Conversion"
              value={`${conversion.toFixed(2)}%`}
              hint="Clicks as a share of views."
            />
          </div>

          <div className="mt-6">
            <Panel title={`Last ${WINDOW_DAYS} days`}>
              <div className="p-5">
                <CampaignTrend data={series} />
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Best performing" description="Ranked by total views.">
              {topByViews.length === 0 ? (
                <EmptyState title="Nothing to rank yet" />
              ) : (
                <DataTable>
                  <THead>
                    <Th>Campaign</Th>
                    <Th align="right">Views</Th>
                    <Th align="right">Clicks</Th>
                    <Th align="right">Conv.</Th>
                  </THead>
                  <TBody>
                    {topByViews.map((c) => (
                      <tr key={c.id} className="hover:bg-secondary/40">
                        <Td>
                          <Link
                            href={`/admin/social-media/campaigns/${c.id}`}
                            className="link-wipe font-medium"
                          >
                            {c.title}
                          </Link>
                          {!c.isActive && (
                            <span className="ml-2 text-xs text-muted-foreground">paused</span>
                          )}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {c.totalViews.toLocaleString()}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {c.totalClicks.toLocaleString()}
                        </Td>
                        <Td align="right" className="tabular-nums text-muted-foreground">
                          {toNumber(c.conversionRate).toFixed(1)}%
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>
              )}
            </Panel>

            <Panel title="Most copied" description="What the team actually reaches for.">
              {topByCopies.length === 0 ? (
                <EmptyState
                  title="No copies yet"
                  description="Use “Copy message” on a campaign to start tracking this."
                />
              ) : (
                <DataTable>
                  <THead>
                    <Th>Campaign</Th>
                    <Th align="right">Copies</Th>
                  </THead>
                  <TBody>
                    {topByCopies.map((c) => (
                      <tr key={c.id} className="hover:bg-secondary/40">
                        <Td>
                          <Link
                            href={`/admin/social-media/campaigns/${c.id}`}
                            className="link-wipe font-medium"
                          >
                            {c.title}
                          </Link>
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {c.copyCount.toLocaleString()}
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>
              )}
            </Panel>
          </div>

          <div className="mt-6">
            <Panel title="Daily breakdown" description={`The last ${WINDOW_DAYS} days.`}>
              <DataTable>
                <THead>
                  <Th>Date</Th>
                  <Th align="right">Views</Th>
                  <Th align="right">Unique</Th>
                  <Th align="right">Clicks</Th>
                  <Th align="right">Copies</Th>
                  <Th align="right">Shares</Th>
                </THead>
                <TBody>
                  {[...series].reverse().map((row) => (
                    <tr key={row.date} className="hover:bg-secondary/40">
                      <Td>
                        {new Date(row.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {row.views.toLocaleString()}
                      </Td>
                      <Td align="right" className="tabular-nums text-muted-foreground">
                        {row.uniqueViews.toLocaleString()}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {row.clicks.toLocaleString()}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {row.copies.toLocaleString()}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {row.shares.toLocaleString()}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
