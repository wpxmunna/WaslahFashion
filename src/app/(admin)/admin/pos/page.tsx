import Link from "next/link";
import { Receipt, RotateCcw } from "lucide-react";

import { PageHeader } from "@/components/admin/ui";
import { PosShiftControls } from "@/components/admin/pos-shift-controls";
import { PosShiftOpen } from "@/components/admin/pos-shift-open";
import { PosTerminal } from "@/components/admin/pos-terminal";
import { buttonVariants } from "@/components/ui/button";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { effectivePrice, formatPrice, toNumber } from "@/lib/money";
import { lineTotal, parseHeldItems } from "@/lib/pos";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata = { title: "Terminal" };

/** Products pre-loaded into the till; anything beyond falls back to a search. */
const CATALOGUE_LIMIT = 200;

export default async function PosTerminalPage() {
  const user = await requireStaff();

  const shift = await prisma.posShift.findFirst({
    where: { userId: user.id, storeId: DEFAULT_STORE_ID, status: "OPEN" },
    select: {
      id: true,
      shiftNumber: true,
      totalSales: true,
      totalTransactions: true,
      terminal: { select: { name: true } },
    },
  });

  if (!shift) {
    const terminals = await prisma.posTerminal.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, location: true },
    });

    return (
      <>
        <PageHeader
          title="POS terminal"
          description="Open a shift to start taking sales at the till."
        />
        <PosShiftOpen terminals={terminals} />
      </>
    );
  }

  const [products, held] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: DEFAULT_STORE_ID, status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: CATALOGUE_LIMIT,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        price: true,
        salePrice: true,
        stockQuantity: true,
      },
    }),
    prisma.posHeldOrder.findMany({
      where: { storeId: DEFAULT_STORE_ID, status: "HELD" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        holdNumber: true,
        customerName: true,
        note: true,
        items: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="POS terminal"
        description={`${shift.terminal.name} · ${shift.shiftNumber} · ${shift.totalTransactions} sale${
          shift.totalTransactions === 1 ? "" : "s"
        } worth ${formatPrice(toNumber(shift.totalSales))} so far.`}
        actions={
          <>
            <Link
              href="/admin/pos/refund"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <RotateCcw className="size-4" strokeWidth={1.8} />
              Refund
            </Link>
            <Link
              href="/admin/pos/transactions"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Receipt className="size-4" strokeWidth={1.8} />
              Transactions
            </Link>
            <PosShiftControls shiftId={shift.id} />
          </>
        }
      />

      <PosTerminal
        shift={{
          id: shift.id,
          shiftNumber: shift.shiftNumber,
          terminalName: shift.terminal.name,
          totalSales: toNumber(shift.totalSales),
          totalTransactions: shift.totalTransactions,
        }}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          price: effectivePrice(p.price, p.salePrice),
          stock: p.stockQuantity,
          image: null,
        }))}
        heldOrders={held.map((h) => {
          const items = parseHeldItems(h.items);
          return {
            id: h.id,
            holdNumber: h.holdNumber,
            customerName: h.customerName,
            note: h.note,
            itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
            total: items.reduce((sum, i) => sum + lineTotal(i), 0),
            createdAt: h.createdAt.toISOString(),
          };
        })}
      />
    </>
  );
}
