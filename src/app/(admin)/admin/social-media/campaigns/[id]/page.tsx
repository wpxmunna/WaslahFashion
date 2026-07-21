import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
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
import { CampaignForm } from "@/components/admin/campaign-form";
import { CampaignGoals } from "@/components/admin/campaign-goals";
import { CampaignNotes } from "@/components/admin/campaign-notes";
import {
  CampaignCopyButton,
  CampaignDuplicate,
  CampaignToggleActive,
  CampaignTogglePinned,
} from "@/components/admin/campaign-actions";
import { deleteCampaign } from "@/actions/admin/campaigns";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, with no zone. */
function toDateTimeLocal(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function toDateOnly(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const campaignId = parseId(id);
  if (campaignId === null) return { title: "Campaign" };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, storeId: DEFAULT_STORE_ID },
    select: { title: true },
  });
  return { title: campaign?.title ?? "Campaign" };
}

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const campaignId = parseId(id);
  if (campaignId === null) notFound();

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, storeId: DEFAULT_STORE_ID },
    include: {
      goals: { orderBy: { createdAt: "desc" } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
      dailyStats: { orderBy: { date: "desc" }, take: 30 },
    },
  });

  if (!campaign) notFound();

  // Goal progress reads the live campaign counters, so a goal added today
  // still reflects everything the campaign has earned.
  const counterFor: Record<string, number> = {
    VIEWS: campaign.totalViews,
    COPIES: campaign.copyCount,
    CLICKS: campaign.totalClicks,
    SHARES: campaign.totalShares,
    ENGAGEMENTS: campaign.totalEngagements,
  };

  const clipboardText = [campaign.content, campaign.hashtags]
    .filter(Boolean)
    .join("\n\n");

  return (
    <>
      <PageHeader
        title={campaign.title}
        description={`Created ${campaign.createdAt.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}${campaign.lastActivityAt ? " · last activity " + campaign.lastActivityAt.toLocaleDateString("en-GB") : ""}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/social-media", label: "Social links" },
          { href: "/admin/social-media/campaigns", label: "Campaigns" },
        ]}
        actions={
          <>
            <CampaignCopyButton id={campaign.id} text={clipboardText} />
            <CampaignTogglePinned id={campaign.id} isPinned={campaign.isPinned} />
            <CampaignToggleActive id={campaign.id} isActive={campaign.isActive} />
            <CampaignDuplicate id={campaign.id} />
            <DeleteButton
              id={campaign.id}
              action={deleteCampaign}
              redirectTo="/admin/social-media/campaigns"
              confirmTitle="Delete this campaign?"
              confirmBody="Its goals, notes and recorded stats are deleted with it."
            />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Views" value={campaign.totalViews.toLocaleString()} />
        <StatCard label="Clicks" value={campaign.totalClicks.toLocaleString()} />
        <StatCard label="Shares" value={campaign.totalShares.toLocaleString()} />
        <StatCard label="Copies" value={campaign.copyCount.toLocaleString()} />
        <StatCard
          label="Conversion"
          value={`${toNumber(campaign.conversionRate).toFixed(2)}%`}
          hint="Clicks as a share of views."
        />
      </div>

      <CampaignForm
        values={{
          id: campaign.id,
          title: campaign.title,
          platform: campaign.platform,
          messageType: campaign.messageType,
          content: campaign.content,
          shortContent: campaign.shortContent ?? "",
          hashtags: campaign.hashtags ?? "",
          callToAction: campaign.callToAction ?? "",
          ctaUrl: campaign.ctaUrl ?? "",
          imageUrl: imageUrl(campaign.imagePath),
          scheduledAt: toDateTimeLocal(campaign.scheduledAt),
          expiresAt: toDateTimeLocal(campaign.expiresAt),
          isActive: campaign.isActive,
          isPinned: campaign.isPinned,
        }}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <CampaignGoals
          campaignId={campaign.id}
          goals={campaign.goals.map((g) => ({
            id: g.id,
            type: g.type,
            targetValue: g.targetValue,
            currentValue: counterFor[g.type] ?? 0,
            startDate: toDateOnly(g.startDate),
            endDate: toDateOnly(g.endDate),
          }))}
        />

        <CampaignNotes
          campaignId={campaign.id}
          notes={campaign.notes.map((n) => ({
            id: n.id,
            note: n.note,
            type: n.type,
            author: n.user?.name ?? null,
            createdAt: n.createdAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
          }))}
        />
      </div>

      <div className="mt-6">
        <Panel title="Daily activity" description="The last 30 days with recorded events.">
          {campaign.dailyStats.length === 0 ? (
            <EmptyState
              title="No activity recorded"
              description="Days appear here once the campaign is viewed, copied or clicked."
            />
          ) : (
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
                {campaign.dailyStats.map((stat) => (
                  <tr key={stat.id} className="hover:bg-secondary/40">
                    <Td>
                      {stat.date.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {stat.views.toLocaleString()}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {stat.uniqueViews.toLocaleString()}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {stat.clicks.toLocaleString()}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {stat.copies.toLocaleString()}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {stat.shares.toLocaleString()}
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
