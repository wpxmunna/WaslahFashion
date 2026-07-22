import { PageHeader } from "@/components/admin/ui";
import { SizeChartForm } from "@/components/admin/size-chart-form";
import { emptySizeChartValues } from "@/components/admin/size-chart-form-constants";
import { requireStaff } from "@/lib/admin/guard";

export const metadata = { title: "New size chart" };

export default async function NewSizeChartPage() {
  await requireStaff();

  return (
    <>
      <PageHeader
        title="New size chart"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/size-charts", label: "Size charts" },
        ]}
      />
      <SizeChartForm values={emptySizeChartValues} />
    </>
  );
}
