import Link from "next/link";
import { notFound } from "next/navigation";

import { deletePurchaseOrder } from "@/actions/admin/purchase-orders";
import { DeleteButton } from "@/components/admin/delete-button";
import { PoForm } from "@/components/admin/po-form";
import { PoPrintButton } from "@/components/admin/po-print-button";
import { PoReceiveForm } from "@/components/admin/po-receive-form";
import { PoStatusActions, type PoStatusValue } from "@/components/admin/po-status-actions";
import { PO_PAYMENT_STATUS_LABELS, PO_STATUS_LABELS } from "@/components/admin/po-status-actions-constants";
import { SUPPLIER_PAYMENT_METHODS } from "@/lib/purchasing";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

const EDITABLE: PoStatusValue[] = ["DRAFT", "PENDING"];
const RECEIVABLE: PoStatusValue[] = ["APPROVED", "ORDERED", "PARTIAL"];

const METHOD_LABELS = new Map(
  SUPPLIER_PAYMENT_METHODS.map((m) => [m.value as string, m.label]),
);

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `YYYY-MM-DD` for a date input, in UTC to match how the column is stored. */
function dateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: Number(id) },
    select: { poNumber: true },
  });
  return { title: po?.poNumber ?? "Purchase order" };
}

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const poId = Number(id);
  if (!Number.isInteger(poId)) notFound();

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, storeId: DEFAULT_STORE_ID },
    include: {
      supplier: {
        select: { id: true, name: true, contactPerson: true, phone: true, email: true },
      },
      items: { orderBy: { id: "asc" } },
      payments: {
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          paymentDate: true,
          paymentMethod: true,
          referenceNumber: true,
        },
      },
    },
  });

  if (!po) notFound();

  const status = po.status as PoStatusValue;
  const isEditable = EDITABLE.includes(status);
  const isReceivable = RECEIVABLE.includes(status);

  const total = toNumber(po.totalAmount);
  const paid = toNumber(po.paidAmount);

  const orderedUnits = po.items.reduce((sum, i) => sum + i.quantityOrdered, 0);
  const receivedUnits = po.items.reduce((sum, i) => sum + i.quantityReceived, 0);
  const progress = orderedUnits > 0 ? Math.round((receivedUnits / orderedUnits) * 100) : 0;

  const [suppliers, products] = isEditable
    ? await Promise.all([
        prisma.supplier.findMany({
          where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.product.findMany({
          where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, sku: true, costPrice: true },
        }),
      ])
    : [[], []];

  return (
    <>
      <PageHeader
        title={po.poNumber}
        description={`${po.supplier.name} · ordered ${formatDate(po.orderDate)}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/purchase-orders", label: "Purchase orders" },
        ]}
        actions={
          <>
            <PoPrintButton />
            <PoStatusActions id={po.id} status={status} />
            {isEditable && (
              <DeleteButton
                id={po.id}
                action={deletePurchaseOrder}
                redirectTo="/admin/purchase-orders"
                label="Delete"
                confirmTitle="Delete this purchase order?"
                confirmBody="Only draft and pending orders can be deleted. Approved orders should be cancelled instead."
              />
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={PO_STATUS_LABELS[status]} />
        <StatCard label="Total" value={formatPrice(total)} />
        <StatCard
          label="Paid"
          value={formatPrice(paid)}
          hint={PO_PAYMENT_STATUS_LABELS[po.paymentStatus] ?? po.paymentStatus}
        />
        <StatCard
          label="Received"
          value={`${receivedUnits} / ${orderedUnits}`}
          hint={`${progress}% of units booked in.`}
        />
      </div>

      <div className="space-y-6">
        <Panel title="Order">
          <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="kicker text-muted-foreground">Supplier</dt>
              <dd className="mt-1 text-sm">
                <Link href={`/admin/suppliers/${po.supplier.id}`} className="link-wipe">
                  {po.supplier.name}
                </Link>
                {po.supplier.contactPerson && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {po.supplier.contactPerson}
                    {po.supplier.phone && ` · ${po.supplier.phone}`}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="kicker text-muted-foreground">Order date</dt>
              <dd className="mt-1 text-sm">{formatDate(po.orderDate)}</dd>
            </div>
            <div>
              <dt className="kicker text-muted-foreground">Expected</dt>
              <dd className="mt-1 text-sm">{formatDate(po.expectedDate)}</dd>
            </div>
            <div>
              <dt className="kicker text-muted-foreground">Received</dt>
              <dd className="mt-1 text-sm">{formatDate(po.receivedDate)}</dd>
            </div>
            {po.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <dt className="kicker text-muted-foreground">Notes</dt>
                <dd className="mt-1 whitespace-pre-line text-sm">{po.notes}</dd>
              </div>
            )}
          </dl>
        </Panel>

        <Panel
          title="Lines"
          description={
            isEditable
              ? "Editable while the order is a draft or pending approval."
              : "Read-only — this order has been approved."
          }
        >
          <DataTable>
            <THead>
              <Th>Item</Th>
              <Th align="right">Ordered</Th>
              <Th align="right">Received</Th>
              <Th align="right">Unit cost</Th>
              <Th align="right">Total</Th>
            </THead>
            <TBody>
              {po.items.map((item) => (
                <tr key={item.id}>
                  <Td>
                    <span className="block font-medium">{item.productName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.productSku ?? "No SKU"}
                      {item.productId === null && " · not a catalogue product"}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {item.quantityOrdered}
                  </Td>
                  <Td
                    align="right"
                    className={
                      item.quantityReceived >= item.quantityOrdered
                        ? "tabular-nums text-emerald-600"
                        : "tabular-nums text-muted-foreground"
                    }
                  >
                    {item.quantityReceived}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(item.unitCost)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(item.totalCost)}
                  </Td>
                </tr>
              ))}
            </TBody>
          </DataTable>

          <dl className="ml-auto max-w-xs space-y-2 border-t border-border p-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(po.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular-nums">{formatPrice(po.taxAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="tabular-nums">{formatPrice(po.shippingAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums">−{formatPrice(po.discountAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(total)}</dd>
            </div>
          </dl>
        </Panel>

        {isReceivable && (
          <div className="print:hidden">
            <PoReceiveForm
              purchaseOrderId={po.id}
              lines={po.items.map((item) => ({
                id: item.id,
                productName: item.productName,
                productSku: item.productSku,
                linkedToCatalogue: item.productId !== null,
                quantityOrdered: item.quantityOrdered,
                quantityReceived: item.quantityReceived,
              }))}
            />
          </div>
        )}

        <Panel
          title="Payments"
          description={`${formatPrice(Math.max(0, total - paid))} outstanding.`}
          actions={
            <Link
              href={`/admin/suppliers/${po.supplier.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Record a payment
            </Link>
          }
        >
          {po.payments.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Record payments from the supplier's page and link them to this order."
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Payment</Th>
                <Th>Date</Th>
                <Th>Method</Th>
                <Th>Reference</Th>
                <Th align="right">Amount</Th>
              </THead>
              <TBody>
                {po.payments.map((payment) => (
                  <tr key={payment.id}>
                    <Td className="font-medium">{payment.paymentNumber}</Td>
                    <Td className="text-muted-foreground">
                      {formatDate(payment.paymentDate)}
                    </Td>
                    <Td className="text-muted-foreground">
                      {METHOD_LABELS.get(payment.paymentMethod) ?? payment.paymentMethod}
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

        {isEditable && (
          <div className="print:hidden">
            <h2 className="mb-4 font-display text-xl">Edit this order</h2>
            <PoForm
              values={{
                id: po.id,
                supplierId: po.supplierId,
                orderDate: dateInputValue(po.orderDate),
                expectedDate: dateInputValue(po.expectedDate),
                status: status as "DRAFT" | "PENDING",
                taxAmount: String(toNumber(po.taxAmount)),
                shippingAmount: String(toNumber(po.shippingAmount)),
                discountAmount: String(toNumber(po.discountAmount)),
                notes: po.notes ?? "",
                lines: po.items.map((item) => ({
                  productId: item.productId,
                  productName: item.productSku
                    ? `${item.productName} (${item.productSku})`
                    : item.productName,
                  quantityOrdered: String(item.quantityOrdered),
                  unitCost: String(toNumber(item.unitCost)),
                })),
              }}
              suppliers={suppliers}
              products={products.map((p) => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                costPrice: p.costPrice === null ? null : toNumber(p.costPrice),
              }))}
            />
          </div>
        )}
      </div>
    </>
  );
}
