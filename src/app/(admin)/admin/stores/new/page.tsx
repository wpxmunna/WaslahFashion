import { PageHeader } from "@/components/admin/ui";
import { StoreForm } from "@/components/admin/store-form";
import { emptyStoreValues } from "@/components/admin/store-form-constants";
import { requireAdmin } from "@/lib/admin/guard";

export const metadata = { title: "New store" };

export default async function NewStorePage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        title="New store"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/stores", label: "Stores" },
        ]}
      />
      <StoreForm values={emptyStoreValues} />
    </>
  );
}
