import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader } from "@/components/admin/ui";
import { SizeChartForm } from "@/components/admin/size-chart-form";
import { deleteSizeChart } from "@/actions/admin/size-charts";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { coerceSizeChart, sizeChartToText } from "@/lib/size-chart";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const chart = await prisma.sizeChart.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: chart?.name ?? "Size chart" };
}

export default async function EditSizeChartPage({ params }: Props) {
  await requireStaff();

  const { id } = await params;
  const chartId = Number(id);
  if (!Number.isInteger(chartId)) notFound();

  const chart = await prisma.sizeChart.findFirst({
    where: { id: chartId, storeId: DEFAULT_STORE_ID },
    select: { id: true, name: true, data: true, _count: { select: { products: true } } },
  });
  if (!chart) notFound();

  return (
    <>
      <PageHeader
        title={chart.name}
        description={`Used by ${chart._count.products} product${chart._count.products === 1 ? "" : "s"}.`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/size-charts", label: "Size charts" },
        ]}
        actions={
          <DeleteButton
            id={chart.id}
            action={deleteSizeChart}
            redirectTo="/admin/size-charts"
            label="Delete"
            confirmTitle="Delete this size chart?"
            confirmBody="Any products using it will simply lose their size guide; nothing else is affected."
          />
        }
      />

      <SizeChartForm
        values={{
          id: chart.id,
          name: chart.name,
          data: sizeChartToText(coerceSizeChart(chart.data)),
        }}
      />
    </>
  );
}
