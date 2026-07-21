import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader } from "@/components/admin/ui";
import { SliderForm } from "@/components/admin/slider-form";
import { deleteSlider } from "@/actions/admin/sliders";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { imageUrl } from "@/lib/images";
import { toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const sliderId = Number(id);
  if (!Number.isInteger(sliderId)) return { title: "Slide" };

  const slider = await prisma.slider.findFirst({
    where: { id: sliderId, storeId: DEFAULT_STORE_ID },
    select: { title: true },
  });
  return { title: slider?.title ?? "Slide" };
}

export default async function EditSliderPage({ params }: Props) {
  const { id } = await params;
  const sliderId = Number(id);
  if (!Number.isInteger(sliderId)) notFound();

  const slider = await prisma.slider.findFirst({
    where: { id: sliderId, storeId: DEFAULT_STORE_ID },
  });
  if (!slider) notFound();

  return (
    <>
      <PageHeader
        title={slider.title}
        description="Homepage hero slide."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/sliders", label: "Sliders" },
        ]}
        actions={
          <DeleteButton
            id={slider.id}
            action={deleteSlider}
            redirectTo="/admin/sliders"
            confirmTitle="Delete this slide?"
            confirmBody="It will be removed from the homepage carousel immediately."
          />
        }
      />

      <SliderForm
        values={{
          id: slider.id,
          title: slider.title,
          subtitle: slider.subtitle ?? "",
          description: slider.description ?? "",
          buttonText: slider.buttonText ?? "",
          buttonLink: slider.buttonLink ?? "",
          button2Text: slider.button2Text ?? "",
          button2Link: slider.button2Link ?? "",
          imageUrl: imageUrl(slider.image),
          textPosition: slider.textPosition,
          textColor: slider.textColor,
          overlayOpacity: String(toNumber(slider.overlayOpacity)),
          sortOrder: String(slider.sortOrder),
          isActive: slider.isActive,
        }}
      />
    </>
  );
}
