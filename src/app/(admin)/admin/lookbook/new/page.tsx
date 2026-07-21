import { PageHeader } from "@/components/admin/ui";
import { LookbookForm } from "@/components/admin/lookbook-form";
import { emptyLookbookValues } from "@/components/admin/lookbook-form-constants";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "New lookbook item" };

export default async function NewLookbookPage() {
  const featured = await prisma.lookbookItem.findFirst({
    where: { storeId: DEFAULT_STORE_ID, isFeatured: true },
    select: { caption: true, id: true },
  });

  return (
    <>
      <PageHeader
        title="New lookbook item"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/lookbook", label: "Lookbook" },
        ]}
      />
      <LookbookForm
        values={emptyLookbookValues}
        featuredElsewhere={featured ? (featured.caption ?? `Item ${featured.id}`) : null}
      />
    </>
  );
}
