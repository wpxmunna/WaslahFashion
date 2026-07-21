import Link from "next/link";
import { ExternalLink, Megaphone, Plus } from "lucide-react";

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
import { ReorderButtons, ToggleActiveButton } from "@/components/admin/content-row-actions";
import { moveSocialLink, toggleSocialLinkActive } from "@/actions/admin/social";
import { AdminSearch } from "@/components/admin/admin-search";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Social links" };

const PER_PAGE = 20;

export default async function AdminSocialMediaPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const placement = first(raw.placement);

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(placement === "header" ? { showInHeader: true } : {}),
    ...(placement === "footer" ? { showInFooter: true } : {}),
    ...(q
      ? { OR: [{ name: { contains: q } }, { platform: { contains: q } }, { url: { contains: q } }] }
      : {}),
  };

  const [links, total] = await Promise.all([
    prisma.socialLink.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        platform: true,
        name: true,
        url: true,
        color: true,
        sortOrder: true,
        isActive: true,
        showInHeader: true,
        showInFooter: true,
      },
    }),
    prisma.socialLink.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (placement) query.set("placement", placement);

  return (
    <>
      <PageHeader
        title="Social links"
        description={`${total} link${total === 1 ? "" : "s"} across the header and footer.`}
        breadcrumb={[{ href: "/admin", label: "Dashboard" }]}
        actions={
          <>
            <Link
              href="/admin/social-media/campaigns"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Megaphone className="size-4" strokeWidth={1.8} />
              Campaigns
            </Link>
            <Link href="/admin/social-media/new" className={cn(buttonVariants(), "gap-1.5")}>
              <Plus className="size-4" strokeWidth={2} />
              New link
            </Link>
          </>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by name, platform or URL"
            filters={[
              {
                name: "placement",
                label: "Placement",
                options: [
                  { value: "", label: "Anywhere" },
                  { value: "header", label: "In the header" },
                  { value: "footer", label: "In the footer" },
                ],
              },
            ]}
          />
        </div>

        {links.length === 0 ? (
          <EmptyState
            title={q || placement ? "No matching links" : "No social links yet"}
            description={
              q || placement
                ? "Try a different search or clear the filters."
                : "Add the accounts you want linked from the storefront."
            }
            action={
              <Link href="/admin/social-media/new" className={buttonVariants()}>
                New link
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Link</Th>
              <Th>Placement</Th>
              <Th align="center">Order</Th>
              <Th align="center">Reorder</Th>
              <Th align="center">Visibility</Th>
            </THead>
            <TBody>
              {links.map((link, i) => (
                <tr key={link.id} className="hover:bg-secondary/40">
                  <Td>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: link.color }}
                      />
                      <span className="min-w-0">
                        <Link
                          href={`/admin/social-media/${link.id}`}
                          className="link-wipe block truncate font-medium"
                        >
                          {link.name}
                        </Link>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="capitalize">{link.platform}</span>
                          <span aria-hidden>·</span>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-64 items-center gap-1 truncate hover:text-foreground"
                          >
                            <span className="truncate">{link.url}</span>
                            <ExternalLink className="size-3 shrink-0" strokeWidth={1.7} />
                          </a>
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1.5">
                      {link.showInHeader && <StatusBadge label="Header" tone="info" />}
                      {link.showInFooter && <StatusBadge label="Footer" tone="neutral" />}
                      {!link.showInHeader && !link.showInFooter && (
                        <StatusBadge label="Nowhere" tone="warning" />
                      )}
                    </span>
                  </Td>
                  <Td align="center" className="tabular-nums text-muted-foreground">
                    {link.sortOrder}
                  </Td>
                  <Td align="center">
                    <ReorderButtons
                      id={link.id}
                      action={moveSocialLink}
                      isFirst={page === 1 && i === 0}
                      isLast={page === totalPages && i === links.length - 1}
                      label={link.name}
                    />
                  </Td>
                  <Td align="center">
                    <ToggleActiveButton
                      id={link.id}
                      action={toggleSocialLinkActive}
                      isActive={link.isActive}
                      label={link.name}
                    />
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
        basePath="/admin/social-media"
      />
    </>
  );
}
