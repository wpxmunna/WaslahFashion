import { PageHeader } from "@/components/admin/ui";
import { CampaignForm } from "@/components/admin/campaign-form";
import { emptyCampaignValues } from "@/components/admin/campaign-form-constants";

export const metadata = { title: "New campaign" };

export default function NewCampaignPage() {
  return (
    <>
      <PageHeader
        title="New campaign"
        description="A reusable message your team can copy when posting."
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/social-media", label: "Social links" },
          { href: "/admin/social-media/campaigns", label: "Campaigns" },
        ]}
      />
      <CampaignForm values={emptyCampaignValues} />
    </>
  );
}
