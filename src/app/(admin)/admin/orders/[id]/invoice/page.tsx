import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { OrderPrintButton } from "@/components/admin/order-print-button";
import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_STORE_ID, SITE } from "@/lib/config";
import { formatPrice, toNumber } from "@/lib/money";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id: Number(id) },
    select: { orderNumber: true },
  });
  return { title: `Invoice ${order?.orderNumber ?? ""}`.trim() };
}

/**
 * The invoice sits inside the admin route group, so it inherits the sidebar
 * chrome. Rather than reaching into the shared layout, it paints over the top
 * on screen and hides everything but itself when printed.
 */
const PRINT_CSS = `
@page { margin: 14mm; }
@media print {
  body * { visibility: hidden !important; }
  [data-invoice], [data-invoice] * { visibility: visible !important; }
  [data-invoice] {
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 100% !important;
    overflow: visible !important;
    background: #fff !important;
  }
  [data-print-hide] { display: none !important; }
}
`;

function addressLines(a: {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}) {
  return [
    a.line1,
    a.line2,
    [a.city, a.state, a.postalCode].filter(Boolean).join(", ") || null,
    a.country,
  ].filter((v): v is string => Boolean(v));
}

export default async function OrderInvoicePage({ params }: Props) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const [order, settingRows] = await Promise.all([
    prisma.order.findFirst({
      where: { id: orderId, storeId: DEFAULT_STORE_ID },
      include: {
        items: { orderBy: { id: "asc" } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.setting.findMany({
      where: { storeId: DEFAULT_STORE_ID, group: "contact" },
      select: { key: true, value: true },
    }),
  ]);

  if (!order) notFound();

  const contact: Record<string, string | null> = Object.fromEntries(
    settingRows.map((s) => [s.key, s.value]),
  );

  const business = {
    name: contact.business_name || SITE.name,
    address: contact.business_address,
    phone: contact.business_phone,
    email: contact.business_email || SITE.email,
    website: contact.website_url,
  };

  const subtotal = toNumber(order.subtotal);
  const discount = toNumber(order.discountAmount);
  const shipping = toNumber(order.shippingAmount);
  const tax = toNumber(order.taxAmount);
  const total = toNumber(order.totalAmount);

  const billing = {
    name: order.billingName ?? order.shippingName,
    phone: order.billingPhone ?? order.shippingPhone,
    lines: addressLines({
      line1: order.billingLine1 ?? order.shippingLine1,
      line2: order.billingLine2 ?? order.shippingLine2,
      city: order.billingCity ?? order.shippingCity,
      state: order.billingState ?? order.shippingState,
      postalCode: order.billingPostalCode ?? order.shippingPostalCode,
      country: order.billingCountry ?? order.shippingCountry,
    }),
  };

  const shippingTo = {
    name: order.shippingName,
    phone: order.shippingPhone,
    lines: addressLines({
      line1: order.shippingLine1,
      line2: order.shippingLine2,
      city: order.shippingCity,
      state: order.shippingState,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    }),
  };

  return (
    <div
      data-invoice
      className="fixed inset-0 z-50 overflow-y-auto bg-white text-neutral-900 print:static print:overflow-visible"
    >
      <style>{PRINT_CSS}</style>

      <div className="mx-auto max-w-3xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
        <div
          data-print-hide
          className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-6"
        >
          <Link
            href={`/admin/orders/${order.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Back to order
          </Link>
          <OrderPrintButton />
        </div>

        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-2xl font-semibold tracking-tight">{business.name}</p>
            <div className="mt-2 space-y-0.5 text-sm text-neutral-600">
              {business.address && <p>{business.address}</p>}
              {business.phone && <p>{business.phone}</p>}
              {business.email && <p>{business.email}</p>}
              {business.website && <p>{business.website}</p>}
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Invoice
            </p>
            <p className="mt-1 text-lg font-medium tabular-nums">{order.orderNumber}</p>
            <p className="mt-1 text-sm text-neutral-600">
              {format(order.createdAt, "d MMM yyyy")}
            </p>
            <p className="mt-2 text-sm capitalize text-neutral-600">
              {order.paymentMethod ?? "—"} · {order.paymentStatus.toLowerCase()}
            </p>
          </div>
        </header>

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          {[
            { title: "Bill to", who: billing },
            { title: "Ship to", who: shippingTo },
          ].map(({ title, who }) => (
            <section key={title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                {title}
              </h2>
              <address className="mt-2 text-sm not-italic leading-relaxed">
                <span className="block font-medium">
                  {who.name ?? order.user?.name ?? "Guest"}
                </span>
                {who.lines.map((line) => (
                  <span key={line} className="block text-neutral-600">
                    {line}
                  </span>
                ))}
                {who.phone && <span className="block text-neutral-600">{who.phone}</span>}
              </address>
            </section>
          ))}
        </div>

        <table className="mt-10 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-neutral-300">
              <th scope="col" className="py-2.5 text-left font-semibold">
                Item
              </th>
              <th scope="col" className="py-2.5 text-left font-semibold">
                SKU
              </th>
              <th scope="col" className="py-2.5 text-right font-semibold">
                Qty
              </th>
              <th scope="col" className="py-2.5 text-right font-semibold">
                Unit price
              </th>
              <th scope="col" className="py-2.5 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-200 align-top">
                <td className="py-2.5">
                  <span className="block">{item.productName}</span>
                  {item.variantInfo && (
                    <span className="block text-xs text-neutral-500">
                      {item.variantInfo}
                    </span>
                  )}
                </td>
                <td className="py-2.5 text-neutral-600">{item.productSku ?? "—"}</td>
                <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatPrice(item.unitPrice)}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatPrice(item.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-600">Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-neutral-600">
                  Discount
                  {order.couponCode && (
                    <span className="ml-1 text-xs">({order.couponCode})</span>
                  )}
                </dt>
                <dd className="tabular-nums">−{formatPrice(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-neutral-600">Shipping</dt>
              <dd className="tabular-nums">{formatPrice(shipping)}</dd>
            </div>
            {tax > 0 && (
              <div className="flex justify-between">
                <dt className="text-neutral-600">Tax</dt>
                <dd className="tabular-nums">{formatPrice(tax)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(total)}</dd>
            </div>
          </dl>
        </div>

        {order.notes && (
          <section className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Order note
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm">{order.notes}</p>
          </section>
        )}

        <footer className="mt-12 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-500">
          <p>Thank you for shopping with {business.name}.</p>
          <p className="mt-1">
            © {format(new Date(), "yyyy")} {business.name}. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
