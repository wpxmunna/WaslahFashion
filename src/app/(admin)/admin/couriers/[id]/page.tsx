import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CourierForm } from "@/components/admin/courier-form";
import { SafeImage } from "@/components/safe-image";
import { deleteCourier } from "@/actions/admin/couriers";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const courier = await prisma.courier.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: courier?.name ?? "Courier" };
}

export default async function EditCourierPage({ params }: Props) {
  await requireStaff();

  const { id } = await params;
  const courierId = Number(id);
  if (!Number.isInteger(courierId)) notFound();

  const courier = await prisma.courier.findFirst({
    where: { id: courierId, storeId: DEFAULT_STORE_ID },
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      logo: true,
      baseRate: true,
      perKgRate: true,
      estimatedDays: true,
      trackingUrl: true,
      isActive: true,
      _count: { select: { shipments: true } },
    },
  });

  if (!courier) notFound();

  const logoSrc = imageUrl(courier.logo);

  return (
    <>
      <PageHeader
        title={courier.name}
        description={`Code: ${courier.code} · ${courier._count.shipments} shipment${
          courier._count.shipments === 1 ? "" : "s"
        }`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/couriers", label: "Couriers" },
        ]}
        actions={
          <DeleteButton
            id={courier.id}
            action={deleteCourier}
            redirectTo="/admin/couriers"
            label="Delete"
            confirmTitle="Delete this courier?"
            confirmBody="If it is referenced by any shipment it will be deactivated instead, so delivery history stays intact."
          />
        }
      />

      {courier.logo && (
        <Panel title="Current logo" className="mb-6">
          <div className="p-5">
            <span className="relative block h-20 w-40 overflow-hidden rounded bg-secondary">
              <SafeImage
                src={logoSrc}
                alt={`${courier.name} logo`}
                fill
                sizes="160px"
                className="object-contain"
                fallbackLabel={courier.name}
              />
            </span>
            <p className="mt-2 text-xs text-muted-foreground">
              Uploading a new logo below replaces this one.
            </p>
          </div>
        </Panel>
      )}

      <CourierForm
        values={{
          id: courier.id,
          name: courier.name,
          code: courier.code,
          description: courier.description ?? "",
          baseRate: String(toNumber(courier.baseRate)),
          perKgRate: String(toNumber(courier.perKgRate)),
          estimatedDays: courier.estimatedDays ?? "",
          trackingUrl: courier.trackingUrl ?? "",
          isActive: courier.isActive,
        }}
      />
    </>
  );
}
