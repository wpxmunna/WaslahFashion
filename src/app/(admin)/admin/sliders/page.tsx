import Link from "next/link";
import { Plus } from "lucide-react";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { ReorderButtons, ToggleActiveButton } from "@/components/admin/content-row-actions";
import { moveSlider, toggleSliderActive } from "@/actions/admin/sliders";
import { AdminSearch } from "@/components/admin/admin-search";
import { Pagination } from "@/components/pagination";
import { SafeImage } from "@/components/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Sliders" };

const PER_PAGE = 20;

export default async function AdminSlidersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const q = first(raw.q)?.trim() ?? "";
  const status = first(raw.status);

  const where = {
    storeId: DEFAULT_STORE_ID,
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "hidden" ? { isActive: false } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { subtitle: { contains: q } }] } : {}),
  };

  const [sliders, total] = await Promise.all([
    prisma.slider.findMany({
      where,
      // Matches the storefront's running order so the list reads as the carousel does.
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        title: true,
        subtitle: true,
        image: true,
        sortOrder: true,
        isActive: true,
      },
    }),
    prisma.slider.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  return (
    <>
      <PageHeader
        title="Sliders"
        description={`${total} homepage slide${total === 1 ? "" : "s"}, shown in this order.`}
        breadcrumb={[{ href: "/admin", label: "Dashboard" }]}
        actions={
          <Link href="/admin/sliders/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New slide
          </Link>
        }
      />

      <Panel>
        <div className="border-b border-border p-4">
          <AdminSearch
            placeholder="Search by title or subtitle"
            filters={[
              {
                name: "status",
                label: "Visibility",
                options: [
                  { value: "", label: "All slides" },
                  { value: "active", label: "Live" },
                  { value: "hidden", label: "Hidden" },
                ],
              },
            ]}
          />
        </div>

        {sliders.length === 0 ? (
          <EmptyState
            title={q || status ? "No matching slides" : "No slides yet"}
            description={
              q || status
                ? "Try a different search or clear the filters."
                : "The homepage hero is empty until you add a slide."
            }
            action={
              <Link href="/admin/sliders/new" className={buttonVariants()}>
                New slide
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Slide</Th>
              <Th align="center">Order</Th>
              <Th align="center">Reorder</Th>
              <Th align="center">Visibility</Th>
            </THead>
            <TBody>
              {sliders.map((s, i) => (
                <tr key={s.id} className="hover:bg-secondary/40">
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="relative h-11 w-20 shrink-0 overflow-hidden rounded bg-secondary">
                        <SafeImage
                          src={imageUrl(s.image)}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                          fallbackLabel={s.title}
                        />
                      </span>
                      <span className="min-w-0">
                        <Link
                          href={`/admin/sliders/${s.id}`}
                          className="link-wipe block truncate font-medium"
                        >
                          {s.title}
                        </Link>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {s.subtitle ?? "No subtitle"}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td align="center" className="tabular-nums text-muted-foreground">
                    {s.sortOrder}
                  </Td>
                  <Td align="center">
                    <ReorderButtons
                      id={s.id}
                      action={moveSlider}
                      isFirst={page === 1 && i === 0}
                      isLast={page === totalPages && i === sliders.length - 1}
                      label={s.title}
                    />
                  </Td>
                  <Td align="center">
                    <ToggleActiveButton
                      id={s.id}
                      action={toggleSliderActive}
                      isActive={s.isActive}
                      label={s.title}
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
        basePath="/admin/sliders"
      />
    </>
  );
}
