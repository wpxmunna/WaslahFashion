import { format } from "date-fns";

import {
  DataTable,
  EmptyState,
  PageHeader,
  Panel,
  TBody,
  THead,
  Td,
  Th,
} from "@/components/admin/ui";
import { InventoryAdjustForm } from "@/components/admin/inventory-adjust-form";
import { requireStaff } from "@/lib/admin/guard";
import { DEFAULT_STORE_ID } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requireStaff();

  const adjustments = await prisma.stockAdjustment.findMany({
    where: { storeId: DEFAULT_STORE_ID },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Correct on-hand stock (stock-take, damage, found items) with an audit trail."
        breadcrumb={[{ href: "/admin", label: "Dashboard" }]}
      />

      <div className="space-y-6">
        <InventoryAdjustForm />

        <Panel title="Recent adjustments">
          {adjustments.length === 0 ? (
            <EmptyState
              title="No adjustments yet"
              description="Stock corrections you make above will be logged here."
            />
          ) : (
            <DataTable>
              <THead>
                <Th>Product</Th>
                <Th align="right">Change</Th>
                <Th align="right">New stock</Th>
                <Th>Reason</Th>
                <Th>By</Th>
                <Th>When</Th>
              </THead>
              <TBody>
                {adjustments.map((a) => (
                  <tr key={a.id} className="hover:bg-secondary/40">
                    <Td>
                      <span className="block font-medium">{a.productName}</span>
                      {a.variantInfo && (
                        <span className="text-xs text-muted-foreground">{a.variantInfo}</span>
                      )}
                    </Td>
                    <Td align="right">
                      <span
                        className={`tabular-nums font-medium ${a.delta > 0 ? "text-primary" : "text-destructive"}`}
                      >
                        {a.delta > 0 ? "+" : ""}
                        {a.delta}
                      </span>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {a.newQuantity}
                    </Td>
                    <Td>
                      <span className="text-sm">{a.reason}</span>
                      {a.note && (
                        <span className="block text-xs text-muted-foreground">{a.note}</span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{a.staffName ?? "—"}</Td>
                    <Td className="text-muted-foreground">
                      {format(a.createdAt, "d MMM · HH:mm")}
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
