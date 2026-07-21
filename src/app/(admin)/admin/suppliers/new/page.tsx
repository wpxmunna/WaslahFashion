import { PageHeader } from "@/components/admin/ui";
import { SupplierForm } from "@/components/admin/supplier-form";
import { emptySupplierValues } from "@/components/admin/supplier-form-constants";

export const metadata = { title: "New supplier" };

export default function NewSupplierPage() {
  return (
    <>
      <PageHeader
        title="New supplier"
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/suppliers", label: "Suppliers" },
        ]}
      />
      <SupplierForm values={emptySupplierValues} />
    </>
  );
}
