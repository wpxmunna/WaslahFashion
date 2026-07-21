import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { DeleteButton } from "@/components/admin/delete-button";
import { ReturnRefundForm } from "@/components/admin/return-refund-form";
import {
  DataTable,
  PageHeader,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { deleteReturn } from "@/actions/admin/returns";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { returnReasonLabel } from "@/lib/returns";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = await prisma.return.findUnique({
    where: { id: Number(id) },
    select: { returnNumber: true },
  });
  return { title: row?.returnNumber ?? "Return" };
}

export default async function AdminReturnDetailPage({ params }: Props) {
  const { id } = await params;
  const returnId = Number(id);
  if (!Number.isInteger(returnId)) notFound();

  const row = await prisma.return.findFirst({
    where: { id: returnId, storeId: DEFAULT_STORE_ID },
    include: {
      items: { orderBy: { id: "asc" } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          user: { select: { id: true, name: true, email: true } },
          shippingName: true,
        },
      },
    },
  });

  if (!row) notFound();

  const itemsValue = row.items.reduce(
    (sum, item) => sum + toNumber(item.unitPrice) * item.quantity,
    0,
  );
  const restoredUnits = row.items.reduce(
    (sum, item) => (item.stockRestored ? sum + item.quantity : sum),
    0,
  );

  return (
    <>
      <PageHeader
        title={row.returnNumber}
        description={`Recorded ${format(row.returnedAt, "d MMM yyyy")} · ${returnReasonLabel(row.reason)}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/returns", label: "Returns" },
        ]}
        actions={
          <>
            <StatusBadge status={row.refundStatus} />
            <DeleteButton
              id={row.id}
              action={deleteReturn}
              redirectTo="/admin/returns"
              label="Delete"
              confirmTitle="Delete this return?"
              confirmBody="Any stock this return put back will be taken out again so inventory stays correct."
            />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel
            title="Returned items"
            description={`${restoredUnits} unit${restoredUnits === 1 ? "" : "s"} were put back into stock.`}
          >
            <DataTable>
              <THead>
                <Th>Product</Th>
                <Th align="right">Unit price</Th>
                <Th align="right">Qty</Th>
                <Th align="center">Stock restored</Th>
                <Th align="right">Line value</Th>
              </THead>
              <TBody>
                {row.items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <span className="block font-medium">
                        {item.productName ?? "Deleted product"}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.variantInfo ?? "No variant"}
                      </span>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(item.unitPrice)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {item.quantity}
                    </Td>
                    <Td align="center">
                      <StatusBadge
                        label={item.stockRestored ? "Restored" : "Not restored"}
                        tone={item.stockRestored ? "success" : "neutral"}
                      />
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(toNumber(item.unitPrice) * item.quantity)}
                    </Td>
                  </tr>
                ))}
              </TBody>
            </DataTable>
            <p className="flex items-baseline justify-between gap-4 border-t border-border px-5 py-3 text-sm">
              <span className="text-muted-foreground">Total value returned</span>
              <span className="font-medium tabular-nums">{formatPrice(itemsValue)}</span>
            </p>
          </Panel>

          {row.reasonDetails && (
            <Panel title="Reason details">
              <p className="whitespace-pre-wrap p-5 text-sm leading-relaxed">
                {row.reasonDetails}
              </p>
            </Panel>
          )}

          <ReturnRefundForm
            returnId={row.id}
            refundAmount={toNumber(row.refundAmount)}
            refundStatus={row.refundStatus}
            adminNotes={row.adminNotes ?? ""}
            orderTotal={toNumber(row.order.totalAmount)}
          />
        </div>

        <div className="space-y-6">
          <Panel title="Order">
            <div className="space-y-2 p-5 text-sm">
              <Link
                href={`/admin/orders/${row.order.id}`}
                className="link-wipe block font-medium"
              >
                {row.order.orderNumber}
              </Link>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={row.order.status} />
                <StatusBadge status={row.order.paymentStatus} />
              </div>
              <p className="text-muted-foreground">
                Order total {formatPrice(row.order.totalAmount)}
                {row.order.paymentMethod && ` · ${row.order.paymentMethod}`}
              </p>
            </div>
          </Panel>

          <Panel title="Customer">
            <div className="space-y-1 p-5 text-sm">
              {row.order.user ? (
                <>
                  <Link
                    href={`/admin/customers/${row.order.user.id}`}
                    className="link-wipe font-medium"
                  >
                    {row.order.user.name}
                  </Link>
                  <p className="text-muted-foreground">{row.order.user.email}</p>
                </>
              ) : (
                <>
                  <p className="font-medium">{row.order.shippingName ?? "Guest"}</p>
                  <p className="text-muted-foreground">No account linked.</p>
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
