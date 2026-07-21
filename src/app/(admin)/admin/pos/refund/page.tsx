import { PageHeader } from "@/components/admin/ui";
import { PosRefundForm } from "@/components/admin/pos-refund-form";
import type { RawSearchParams } from "@/lib/search-params";

export const metadata = { title: "POS refund" };

export default async function PosRefundPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const number = Array.isArray(raw.number) ? raw.number[0] : raw.number;

  return (
    <>
      <PageHeader
        title="Refund"
        description="Look up a till receipt, choose what is coming back, and the stock is restored with it."
        breadcrumb={[
          { href: "/admin/pos", label: "POS" },
          { href: "/admin/pos/refund", label: "Refund" },
        ]}
      />

      <PosRefundForm initialNumber={number ?? ""} />
    </>
  );
}
