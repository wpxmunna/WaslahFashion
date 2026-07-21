import { PageHeader } from "@/components/admin/ui";
import { SocialForm } from "@/components/admin/social-form";
import { emptySocialValues } from "@/components/admin/social-form-constants";

export const metadata = { title: "New social link" };

export default function NewSocialLinkPage() {
  return (
    <>
      <PageHeader
        title="New social link"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/social-media", label: "Social links" },
        ]}
      />
      <SocialForm values={emptySocialValues} />
    </>
  );
}
