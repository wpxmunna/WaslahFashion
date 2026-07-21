import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/admin/delete-button";
import { PageHeader } from "@/components/admin/ui";
import { SocialForm } from "@/components/admin/social-form";
import { deleteSocialLink } from "@/actions/admin/social";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

/**
 * `/admin/social-media/campaigns` and `/insights` are sibling static routes.
 * Next.js resolves those before this dynamic segment, but the integer guard
 * keeps a stray non-numeric segment from reaching Prisma regardless.
 */
function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const linkId = parseId(id);
  if (linkId === null) return { title: "Social link" };

  const link = await prisma.socialLink.findFirst({
    where: { id: linkId, storeId: DEFAULT_STORE_ID },
    select: { name: true },
  });
  return { title: link?.name ?? "Social link" };
}

export default async function EditSocialLinkPage({ params }: Props) {
  const { id } = await params;
  const linkId = parseId(id);
  if (linkId === null) notFound();

  const link = await prisma.socialLink.findFirst({
    where: { id: linkId, storeId: DEFAULT_STORE_ID },
  });
  if (!link) notFound();

  return (
    <>
      <PageHeader
        title={link.name}
        description={link.url}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/social-media", label: "Social links" },
        ]}
        actions={
          <DeleteButton
            id={link.id}
            action={deleteSocialLink}
            redirectTo="/admin/social-media"
            confirmTitle="Delete this link?"
            confirmBody="It will be removed from the header and footer immediately."
          />
        }
      />

      <SocialForm
        values={{
          id: link.id,
          platform: link.platform,
          name: link.name,
          url: link.url,
          icon: link.icon,
          iconStyle: link.iconStyle,
          color: link.color,
          sortOrder: String(link.sortOrder),
          isActive: link.isActive,
          showInHeader: link.showInHeader,
          showInFooter: link.showInFooter,
          openNewTab: link.openNewTab,
        }}
      />
    </>
  );
}
