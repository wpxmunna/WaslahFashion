import { PageHeader } from "@/components/admin/ui";
import { SliderForm } from "@/components/admin/slider-form";
import { emptySliderValues } from "@/components/admin/slider-form-constants";

export const metadata = { title: "New slide" };

export default function NewSliderPage() {
  return (
    <>
      <PageHeader
        title="New slide"
        description="Slides run in the homepage hero carousel."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/sliders", label: "Sliders" },
        ]}
      />
      <SliderForm values={emptySliderValues} />
    </>
  );
}
