import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Printer } from "lucide-react";

import {
  OrderNoteForm,
  OrderShipmentForm,
  OrderStatusForm,
} from "@/components/admin/order-forms";
import { OrderAddressForm } from "@/components/admin/order-address-form";
import { OrderItemsEditor } from "@/components/admin/order-items-editor";
import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  StatusBadge,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id: Number(id) },
    select: { orderNumber: true },
  });
  return { title: order?.orderNumber ?? "Order" };
}

type AddressParts = {
  name: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

function AddressBlock({ title, address }: { title: string; address: AddressParts }) {
  const lines = [
    address.line1,
    address.line2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(", ") || null,
    address.country,
  ].filter(Boolean);

  const empty = !address.name && lines.length === 0;

  return (
    <div>
      <p className="kicker text-muted-foreground">{title}</p>
      {empty ? (
        <p className="mt-2 text-sm text-muted-foreground">Not provided.</p>
      ) : (
        <address className="mt-2 text-sm not-italic leading-relaxed">
          {address.name && <span className="block font-medium">{address.name}</span>}
          {lines.map((line) => (
            <span key={line} className="block text-muted-foreground">
              {line}
            </span>
          ))}
          {address.phone && (
            <span className="mt-1 block text-muted-foreground">{address.phone}</span>
          )}
        </address>
      )}
    </div>
  );
}

function MoneyRow({
  label,
  value,
  hint,
  strong,
  negative,
}: {
  label: string;
  value: number;
  hint?: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-1.5",
        strong && "mt-1.5 border-t border-border pt-3 text-base font-medium",
      )}
    >
      <span className={cn("text-sm", !strong && "text-muted-foreground")}>
        {label}
        {hint && <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className="tabular-nums">
        {negative && value > 0 ? "−" : ""}
        {formatPrice(value)}
      </span>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const [order, couriers] = await Promise.all([
    prisma.order.findFirst({
      where: { id: orderId, storeId: DEFAULT_STORE_ID },
      include: {
        items: { orderBy: { id: "asc" } },
        payments: { orderBy: { createdAt: "desc" } },
        user: { select: { id: true, name: true, email: true, phone: true } },
        shipment: {
          include: { events: { orderBy: { trackedAt: "desc" } } },
        },
        returns: {
          select: { id: true, returnNumber: true, refundStatus: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.courier.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!order) notFound();

  const subtotal = toNumber(order.subtotal);
  const discount = toNumber(order.discountAmount);
  const shipping = toNumber(order.shippingAmount);
  const tax = toNumber(order.taxAmount);
  const total = toNumber(order.totalAmount);
  const shipment = order.shipment;
  const events = shipment?.events ?? [];

  // Orders can be edited before they leave the building.
  const editable = order.status === "PENDING" || order.status === "PROCESSING";
  const editableItems = order.items.map((i) => ({
    id: i.id,
    productName: i.productName,
    variantInfo: i.variantInfo,
    productSku: i.productSku,
    quantity: i.quantity,
    unitPrice: toNumber(i.unitPrice),
    totalPrice: toNumber(i.totalPrice),
    isGift: i.isGift,
  }));

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        description={`Placed ${format(order.createdAt, "d MMM yyyy")} · ${order.items.length} line${order.items.length === 1 ? "" : "s"}`}
        breadcrumb={[
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/orders", label: "Orders" },
        ]}
        actions={
          <>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
            <Link
              href={`/admin/orders/${order.id}/invoice`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <Printer className="size-3.5" strokeWidth={1.8} />
              Invoice
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel
            title="Items"
            description={editable ? "Add, remove or adjust quantities — stock and totals update automatically." : undefined}
          >
            {editable ? (
              <OrderItemsEditor
                orderId={order.id}
                items={editableItems}
                totals={{ subtotal, discount, shipping, tax, total, couponCode: order.couponCode }}
              />
            ) : (
              <>
                <DataTable>
                  <THead>
                    <Th>Product</Th>
                    <Th align="right">Unit price</Th>
                    <Th align="right">Qty</Th>
                    <Th align="right">Total</Th>
                  </THead>
                  <TBody>
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <Td>
                          <span className="block font-medium">
                            {item.productName}
                            {item.isGift && (
                              <span className="ml-2 align-middle">
                                <StatusBadge label="Gift" tone="accent" />
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {[item.variantInfo, item.productSku]
                              .filter(Boolean)
                              .join(" · ") || "No variant"}
                          </span>
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {formatPrice(item.unitPrice)}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {item.quantity}
                        </Td>
                        <Td align="right" className="tabular-nums">
                          {formatPrice(item.totalPrice)}
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </DataTable>

                <div className="border-t border-border p-5">
                  <div className="ml-auto max-w-sm">
                    <MoneyRow label="Subtotal" value={subtotal} />
                    {discount > 0 && (
                      <MoneyRow
                        label="Discount"
                        hint={order.couponCode ? `(${order.couponCode})` : undefined}
                        value={discount}
                        negative
                      />
                    )}
                    <MoneyRow label="Shipping" value={shipping} />
                    {tax > 0 && <MoneyRow label="Tax" value={tax} />}
                    <MoneyRow label="Total" value={total} strong />
                  </div>
                </div>
              </>
            )}
          </Panel>

          {editable ? (
            <OrderAddressForm
              orderId={order.id}
              values={{
                shippingName: order.shippingName ?? "",
                shippingPhone: order.shippingPhone ?? "",
                shippingLine1: order.shippingLine1 ?? "",
                shippingLine2: order.shippingLine2 ?? "",
                shippingCity: order.shippingCity ?? "",
                shippingState: order.shippingState ?? "",
                shippingPostalCode: order.shippingPostalCode ?? "",
              }}
            />
          ) : (
            <Panel title="Addresses">
              <div className="grid gap-8 p-5 sm:grid-cols-2">
                <AddressBlock
                  title="Shipping"
                  address={{
                    name: order.shippingName,
                    phone: order.shippingPhone,
                    line1: order.shippingLine1,
                    line2: order.shippingLine2,
                    city: order.shippingCity,
                    state: order.shippingState,
                    postalCode: order.shippingPostalCode,
                    country: order.shippingCountry,
                  }}
                />
                <AddressBlock
                  title="Billing"
                  address={{
                    name: order.billingName,
                    phone: order.billingPhone,
                    line1: order.billingLine1,
                    line2: order.billingLine2,
                    city: order.billingCity,
                    state: order.billingState,
                    postalCode: order.billingPostalCode,
                    country: order.billingCountry,
                  }}
                />
              </div>
            </Panel>
          )}

          <Panel title="Payments" description={order.paymentMethod ?? undefined}>
            {order.payments.length === 0 ? (
              <EmptyState
                title="No payment records"
                description="Nothing has been captured against this order yet."
              />
            ) : (
              <DataTable>
                <THead>
                  <Th>Gateway</Th>
                  <Th>Transaction</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th align="right">Amount</Th>
                </THead>
                <TBody>
                  {order.payments.map((p) => (
                    <tr key={p.id}>
                      <Td>
                        <span className="block font-medium capitalize">{p.gateway}</span>
                        {p.method && (
                          <span className="text-xs text-muted-foreground">{p.method}</span>
                        )}
                      </Td>
                      <Td className="text-muted-foreground">
                        {p.transactionId ?? "—"}
                      </Td>
                      <Td>
                        <StatusBadge status={p.status} />
                      </Td>
                      <Td className="text-muted-foreground">
                        {format(p.createdAt, "d MMM yyyy")}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {formatPrice(p.amount)}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            )}
          </Panel>

          <Panel
            title="Tracking"
            description={
              shipment
                ? [
                    shipment.courierName ?? "No courier",
                    shipment.trackingNumber ?? "No tracking number",
                  ].join(" · ")
                : undefined
            }
          >
            {events.length === 0 ? (
              <EmptyState
                title="No tracking events"
                description="Assign a courier and update the shipment status to start the timeline."
              />
            ) : (
              <ol className="space-y-0 p-5">
                {events.map((event, i) => (
                  <li key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "mt-1.5 size-2.5 shrink-0 rounded-full",
                          i === 0 ? "bg-primary" : "bg-border",
                        )}
                      />
                      {i < events.length - 1 && (
                        <span className="w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-6">
                      <StatusBadge
                        status={event.status}
                        label={event.status.replace(/_/g, " ").toLowerCase()}
                      />
                      {event.description && (
                        <p className="mt-1.5 text-sm">{event.description}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(event.trackedAt, "d MMM yyyy · HH:mm")}
                        {event.location && ` · ${event.location}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Notes">
            {order.notes && (
              <div className="border-b border-border p-5">
                <p className="kicker text-muted-foreground">Customer note</p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{order.notes}</p>
              </div>
            )}
            {order.adminNotes ? (
              <div className="p-5">
                <p className="kicker text-muted-foreground">Internal trail</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {order.adminNotes}
                </p>
              </div>
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                No internal notes yet.
              </p>
            )}
            <OrderNoteForm orderId={order.id} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <div className="space-y-1 p-5 text-sm">
              {order.user ? (
                <>
                  <Link
                    href={`/admin/customers/${order.user.id}`}
                    className="link-wipe font-medium"
                  >
                    {order.user.name}
                  </Link>
                  <p className="text-muted-foreground">{order.user.email}</p>
                  {order.user.phone && (
                    <p className="text-muted-foreground">{order.user.phone}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium">{order.shippingName ?? "Guest"}</p>
                  <p className="text-muted-foreground">
                    Guest checkout — no account linked.
                  </p>
                  {order.shippingPhone && (
                    <p className="text-muted-foreground">{order.shippingPhone}</p>
                  )}
                </>
              )}
            </div>
          </Panel>

          <OrderStatusForm
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
          />

          <OrderShipmentForm
            orderId={order.id}
            couriers={couriers}
            shipment={
              order.shipment
                ? {
                    courierId: order.shipment.courierId,
                    trackingNumber: order.shipment.trackingNumber,
                    status: order.shipment.status,
                  }
                : null
            }
          />

          {order.returns.length > 0 && (
            <Panel title="Returns">
              <ul className="divide-y divide-border">
                {order.returns.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <Link href={`/admin/returns/${r.id}`} className="link-wipe text-sm">
                      {r.returnNumber}
                    </Link>
                    <StatusBadge status={r.refundStatus} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
