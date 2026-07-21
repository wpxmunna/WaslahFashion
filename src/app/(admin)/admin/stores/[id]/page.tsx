import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader, Panel, StatCard } from "@/components/admin/ui";
import { StoreForm } from "@/components/admin/store-form";
import { StoreDefaultButton } from "@/components/admin/store-default-button";
import { SafeImage } from "@/components/safe-image";
import { deleteStore } from "@/actions/admin/stores";
import { requireAdmin } from "@/lib/admin/guard";
import { imageUrl } from "@/lib/images";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: store?.name ?? "Store" };
}

export default async function EditStorePage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;
  const storeId = Number(id);
  if (!Number.isInteger(storeId)) notFound();

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logo: true,
      email: true,
      phone: true,
      address: true,
      taxRate: true,
      isActive: true,
      isDefault: true,
      _count: { select: { products: true, orders: true, users: true } },
    },
  });

  if (!store) notFound();

  return (
    <>
      <PageHeader
        title={store.name}
        description={`/${store.slug}${store.isDefault ? " · Default store" : ""}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/stores", label: "Stores" },
        ]}
        actions={
          <>
            {!store.isDefault && <StoreDefaultButton id={store.id} />}
            <DeleteButton
              id={store.id}
              action={deleteStore}
              redirectTo="/admin/stores"
              label="Delete"
              confirmTitle="Delete this store?"
              confirmBody="Deletion is refused while the store still has products or orders, or while it is the default store."
            />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Products" value={String(store._count.products)} />
        <StatCard label="Orders" value={String(store._count.orders)} />
        <StatCard label="Users" value={String(store._count.users)} />
      </div>

      {store.logo && (
        <Panel title="Current logo" className="mb-6">
          <div className="p-5">
            <span className="relative block h-20 w-40 overflow-hidden rounded bg-secondary">
              <SafeImage
                src={imageUrl(store.logo)}
                alt={`${store.name} logo`}
                fill
                sizes="160px"
                className="object-contain"
                fallbackLabel={store.name}
              />
            </span>
            <p className="mt-2 text-xs text-muted-foreground">
              Uploading a new logo below replaces this one.
            </p>
          </div>
        </Panel>
      )}

      <StoreForm
        values={{
          id: store.id,
          name: store.name,
          slug: store.slug,
          description: store.description ?? "",
          email: store.email ?? "",
          phone: store.phone ?? "",
          address: store.address ?? "",
          taxRate: String(toNumber(store.taxRate)),
          isActive: store.isActive,
          isDefault: store.isDefault,
        }}
      />
    </>
  );
}
