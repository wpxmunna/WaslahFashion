import { ColorManager } from "@/components/admin/color-manager";
import { PageHeader } from "@/components/admin/ui";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Colours" };

export default async function AdminColorsPage() {
  // A small lookup table, so the whole thing is edited on one page rather than
  // through a create/edit/list round trip.
  const colors = await prisma.color.findMany({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      hex: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { variants: true } },
    },
  });

  const activeCount = colors.filter((c) => c.isActive).length;

  return (
    <>
      <PageHeader
        title="Colours"
        description={`${activeCount} of ${colors.length} colour${
          colors.length === 1 ? "" : "s"
        } available to product variants.`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/products", label: "Catalogue" },
        ]}
      />

      <ColorManager
        colors={colors.map((c) => ({
          id: c.id,
          name: c.name,
          hex: c.hex,
          sortOrder: c.sortOrder,
          isActive: c.isActive,
          variantCount: c._count.variants,
        }))}
      />
    </>
  );
}
