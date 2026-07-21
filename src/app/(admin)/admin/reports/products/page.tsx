import Link from "next/link";

import { ReportDateRange } from "@/components/admin/report-date-range";
import { ReportTabs, SALES_REPORT_TABS } from "@/components/admin/report-tabs";
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
import { requireStaff } from "@/lib/admin/guard";
import { formatPrice } from "@/lib/money";
import {
  getProductReport,
  parseDateRange,
  type ProductReportRow,
} from "@/lib/queries/reports";
import type { RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Product report" };

function MiniTable({ rows }: { rows: ProductReportRow[] }) {
  return (
    <DataTable>
      <THead>
        <Th>Product</Th>
        <Th align="right">Units</Th>
        <Th align="right">Revenue</Th>
      </THead>
      <TBody>
        {rows.map((p) => (
          <tr key={p.id} className="hover:bg-secondary/40">
            <Td>
              <Link href={`/admin/products/${p.id}`} className="link-wipe block truncate">
                {p.name}
              </Link>
            </Td>
            <Td align="right" className="tabular-nums">
              {p.units}
            </Td>
            <Td align="right" className="tabular-nums">
              {formatPrice(p.revenue)}
            </Td>
          </tr>
        ))}
      </TBody>
    </DataTable>
  );
}

export default async function ProductReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  await requireStaff();

  const raw = await searchParams;
  const range = parseDateRange(raw);
  const report = await getProductReport(range);

  const query = `start=${range.startKey}&end=${range.endKey}`;
  const t = report.totals;
  const withCost = report.products.filter((p) => p.hasCost).length;
  const marginPercent = t.revenue > 0 ? (t.margin / t.revenue) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Product report"
        description={`${range.startKey} to ${range.endKey}`}
        breadcrumb={[
          { href: "/admin/reports", label: "Sales reports" },
          { href: "/admin/reports/products", label: "Products" },
        ]}
      />

      <ReportTabs items={SALES_REPORT_TABS} active="/admin/reports/products" query={query} />

      <Panel className="mb-6">
        <ReportDateRange
          start={range.startKey}
          end={range.endKey}
          exportHref={`/admin/reports/export/products?${query}`}
        />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Units sold" value={String(t.units)} hint={`${t.distinctProducts} products`} />
        <StatCard label="Revenue" value={formatPrice(t.revenue)} />
        <StatCard
          label="Estimated margin"
          value={formatPrice(t.margin)}
          hint={`${marginPercent.toFixed(1)}% · ${withCost} of ${t.distinctProducts} have a cost price`}
        />
        <StatCard label="Cost of goods" value={formatPrice(t.cost)} hint="At current cost prices" />
      </div>

      {report.products.length === 0 ? (
        <Panel className="mt-6">
          <EmptyState
            title="Nothing sold in this range"
            description="Widen the date range to see product performance."
          />
        </Panel>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Best sellers" description="Most units sold">
              <MiniTable rows={report.best} />
            </Panel>
            <Panel title="Slowest movers" description="Fewest units sold, of those that sold at all">
              <MiniTable rows={report.worst} />
            </Panel>
          </div>

          <Panel
            title="All products sold"
            description="Margin is shown only where the product has a cost price"
          >
            <DataTable>
              <THead>
                <Th>Product</Th>
                <Th align="right">Units</Th>
                <Th align="right">Revenue</Th>
                <Th align="right">Cost</Th>
                <Th align="right">Margin</Th>
                <Th align="right">Stock</Th>
              </THead>
              <TBody>
                {report.products.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/40">
                    <Td>
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="link-wipe block truncate font-medium"
                      >
                        {p.name}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {p.sku ?? "No SKU"}
                      </span>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {p.units}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPrice(p.revenue)}
                    </Td>
                    <Td align="right" className="tabular-nums text-muted-foreground">
                      {p.hasCost ? formatPrice(p.cost) : "—"}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {p.hasCost ? (
                        <>
                          <span className={cn(p.margin < 0 && "text-destructive")}>
                            {formatPrice(p.margin)}
                          </span>
                          {p.marginPercent !== null && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {p.marginPercent.toFixed(0)}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">No cost price</span>
                      )}
                    </Td>
                    <Td
                      align="right"
                      className={cn("tabular-nums", p.stock <= 0 && "text-destructive")}
                    >
                      {p.stock}
                    </Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-secondary/40 font-medium">
                  <Td>Total</Td>
                  <Td align="right" className="tabular-nums">
                    {t.units}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(t.revenue)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(t.cost)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPrice(t.margin)}
                  </Td>
                  <Td />
                </tr>
              </TBody>
            </DataTable>
          </Panel>
        </div>
      )}
    </>
  );
}
