import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { deleteSupplier } from "@/actions/admin/suppliers";
import { DeleteButton } from "@/components/admin/delete-button";
import { SupplierForm } from "@/components/admin/supplier-form";
import {
  SupplierPaymentForm,
} from "@/components/admin/supplier-payment-form";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { SUPPLIER_PAYMENT_METHODS } from "@/lib/purchasing";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

/** Date columns are stored at UTC midnight, so render them in UTC too. */
function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const METHOD_LABELS = new Map(
  SUPPLIER_PAYMENT_METHODS.map((m) => [m.value as string, m.label]),
);

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: supplier?.name ?? "Supplier" };
}

export default async function SupplierDetailPage({ params }: Props) {
  const { id } = await params;
  const supplierId = Number(id);
  if (!Number.isInteger(supplierId)) notFound();

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, storeId: DEFAULT_STORE_ID },
    include: {
      purchaseOrders: {
        orderBy: [{ orderDate: "desc" }, { id: "desc" }],
        select: {
          id: true,
          poNumber: true,
          orderDate: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          paidAmount: true,
        },
      },
      payments: {
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          referenceNumber: true,
          purchaseOrder: { select: { id: true, poNumber: true } },
        },
      },
    },
  });

  if (!supplier) notFound();

  const purchased = toNumber(supplier.totalPurchases);
  const paid = toNumber(supplier.totalPaid);
  const outstanding = purchased - paid;

  // Only orders that still owe something are worth offering on the payment form.
  const payable = supplier.purchaseOrders
    .filter((po) => po.status !== "CANCELLED")
    .map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      outstanding: toNumber(po.totalAmount) - toNumber(po.paidAmount),
    }))
    .filter((po) => po.outstanding > 0);

  return (
    <>
      <PageHeader
        title={supplier.name}
        description={
          supplier.code
            ? `Code ${supplier.code} · ${supplier.paymentTerms} day terms`
            : `${supplier.paymentTerms} day terms`
        }
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/suppliers", label: "Suppliers" },
        ]}
        actions={
          <>
            <Link
              href={`/admin/purchase-orders/new?supplier=${supplier.id}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Plus className="size-4" strokeWidth={2} />
              New purchase order
            </Link>
            <DeleteButton
              id={supplier.id}
              action={deleteSupplier}
              redirectTo="/admin/suppliers"
              label="Delete"
              confirmTitle="Delete this supplier?"
              confirmBody="Suppliers with purchase history are deactivated instead, so the history stays intact."
            />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total purchased" value={formatPrice(purchased)} />
        <StatCard label="Total paid" value={formatPrice(paid)} />
        <StatCard
          label="Outstanding balance"
          value={formatPrice(outstanding)}
          hint={outstanding > 0 ? "Owed to this supplier." : "Nothing outstanding."}
        />
      </div>

      <SupplierForm
        values={{
          id: supplier.id,
          name: supplier.name,
          code: supplier.code ?? "",
          contactPerson: supplier.contactPerson ?? "",
          email: supplier.email ?? "",
          phone: supplier.phone ?? "",
          address: supplier.address ?? "",
          city: supplier.city ?? "",
          country: supplier.country,
          paymentTerms: String(supplier.paymentTerms),
          notes: supplier.notes ?? "",
          status: supplier.status,
        }}
      />

      <div className="mt-6 space-y-6">
        <SupplierPaymentForm supplierId={supplier.id} purchaseOrders={payable} />

        <Panel
          title="Purchase orders"
          description={`${supplier.purchaseOrders.length} order${
            supplier.purchaseOrders.length === 1 ? "" : "s"
          }.`}
        >
          {supplier.purchaseOrders.length === 0 ? (
            <EmptyState
              title="No purchase orders yet"
              description="Raise a purchase order to start tracking what you buy from this supplier."
              action={
                <Link
                  href={`/admin/purchase-orders/new?supplier=${supplier.id}`}
                  className={buttonVariants()}
                >
                  New purchase order
                </Link>
              }
            />
          ) : (
            <DataTable>
              <THead>
                <Th>PO number</Th>
                <Th>Order date</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th align="right">Total</Th>
                <Th align="right">Outstanding</Th>
              </THead>
              <TBody>
                {supplier.purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/purchase-orders/${po.id}`}
                        className="link-wipe font-medium"
                      >
                        {po.poNumber}
                      </Link>
                    </Td>
                    <Td className="text-muted-foreground">{formatDate(po.orderDate)}</Td>
                    <Td>
                      <StatusBadge status={po.status} />
                    </Td>
                    <Td>
                      <StatusBadge status={po.paymentStatus} />
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(po.totalAmount)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {formatPrice(
                        Math.max(0, toNumber(po.totalAmount) - toNumber(po.paidAmount)),
                      )}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>

        <Panel
          title="Payment history"
          description={`${supplier.payments.length} payment${
            supplier.payments.length === 1 ? "" : "s"
          }.`}
        >
          {supplier.payments.length === 0 ? (
            <EmptyState
              title="No payments recorded"
              description="Payments recorded above appear here."
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Payment</Th>
                <Th>Date</Th>
                <Th>Method</Th>
                <Th>Against</Th>
                <Th>Reference</Th>
                <Th align="right">Amount</Th>
              </THead>
              <TBody>
                {supplier.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-secondary/40">
                    <Td className="font-medium">{payment.paymentNumber}</Td>
                    <Td className="text-muted-foreground">
                      {formatDate(payment.paymentDate)}
                    </Td>
                    <Td className="text-muted-foreground">
                      {METHOD_LABELS.get(payment.paymentMethod) ?? payment.paymentMethod}
                    </Td>
                    <Td>
                      {payment.purchaseOrder ? (
                        <Link
                          href={`/admin/purchase-orders/${payment.purchaseOrder.id}`}
                          className="link-wipe"
                        >
                          {payment.purchaseOrder.poNumber}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">On account</span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">
                      {payment.referenceNumber ?? "—"}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(payment.amount)}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </Panel>
      </div>
    </>
  );
}
