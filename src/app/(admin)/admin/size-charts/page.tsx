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
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { coerceSizeChart } from "@/lib/size-chart";
import { cn } from "@/lib/utils";

export const metadata = { title: "Size charts" };

export default async function AdminSizeChartsPage() {
  await requireStaff();

  const charts = await prisma.sizeChart.findMany({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      data: true,
      _count: { select: { products: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Size charts"
        description={`${charts.length} reusable chart${charts.length === 1 ? "" : "s"}. Assign one to a product from its edit page.`}
        actions={
          <Link href="/admin/size-charts/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-4" strokeWidth={2} />
            New size chart
          </Link>
        }
      />

      <Panel>
        {charts.length === 0 ? (
          <EmptyState
            title="No size charts yet"
            description="Create a chart once — e.g. “Half-sleeve Shirt” — then assign it to every product that shares it."
            action={
              <Link href="/admin/size-charts/new" className={buttonVariants()}>
                New size chart
              </Link>
            }
          />
        ) : (
          <DataTable>
            <THead>
              <Th>Name</Th>
              <Th>Columns</Th>
              <Th align="right">Sizes</Th>
              <Th align="right">Products</Th>
            </THead>
            <TBody>
              {charts.map((c) => {
                const parsed = coerceSizeChart(c.data);
                return (
                  <tr key={c.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/size-charts/${c.id}`}
                        className="link-wipe block font-medium"
                      >
                        {c.name}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">
                      {parsed ? parsed.columns.join(" · ") : "—"}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {parsed ? parsed.rows.length : 0}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {c._count.products}
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </DataTable>
        )}
      </Panel>
    </>
  );
}
