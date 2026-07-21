import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader } from "@/components/admin/ui";
import { LookbookForm } from "@/components/admin/lookbook-form";
import { deleteLookbookItem } from "@/actions/admin/lookbook";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) return { title: "Lookbook item" };

  const item = await prisma.lookbookItem.findFirst({
    where: { id: itemId, storeId: DEFAULT_STORE_ID },
    select: { caption: true },
  });
  return { title: item?.caption ?? "Lookbook item" };
}

export default async function EditLookbookPage({ params }: Props) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) notFound();

  const [item, featured] = await Promise.all([
    prisma.lookbookItem.findFirst({
      where: { id: itemId, storeId: DEFAULT_STORE_ID },
    }),
    prisma.lookbookItem.findFirst({
      where: { storeId: DEFAULT_STORE_ID, isFeatured: true, id: { not: itemId } },
      select: { id: true, caption: true },
    }),
  ]);

  if (!item) notFound();

  return (
    <>
      <PageHeader
        title={item.caption ?? `Lookbook item ${item.id}`}
        description={item.isFeatured ? "This is the featured item." : undefined}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/lookbook", label: "Lookbook" },
        ]}
        actions={
          <DeleteButton
            id={item.id}
            action={deleteLookbookItem}
            redirectTo="/admin/lookbook"
            confirmTitle="Delete this lookbook item?"
            confirmBody="It will disappear from the homepage mosaic immediately."
          />
        }
      />

      <LookbookForm
        values={{
          id: item.id,
          imageUrl: imageUrl(item.image),
          link: item.link ?? "",
          caption: item.caption ?? "",
          isFeatured: item.isFeatured,
          sortOrder: String(item.sortOrder),
          isActive: item.isActive,
        }}
        featuredElsewhere={featured ? (featured.caption ?? `Item ${featured.id}`) : null}
      />
    </>
  );
}
