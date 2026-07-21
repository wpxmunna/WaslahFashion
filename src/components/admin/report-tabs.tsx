import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Sub-navigation for the report families. A plain server component — the active
 * item is passed in rather than read from `usePathname()`, so the report pages
 * stay server-rendered.
 */
export function ReportTabs({
  items,
  active,
  query,
}: {
  items: { href: string; label: string }[];
  active: string;
  /** Carries the current date range across tabs. */
  query?: string;
}) {
  return (
    <nav aria-label="Reports" className="mb-6 flex flex-wrap gap-1.5">
      {items.map((item) => {
        const href = query ? `${item.href}?${query}` : item.href;
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const FINANCE_REPORT_TABS = [
  { href: "/admin/finance-reports", label: "Overview" },
  { href: "/admin/finance-reports/profit-loss", label: "Profit & loss" },
  { href: "/admin/finance-reports/cash-flow", label: "Cash flow" },
  { href: "/admin/finance-reports/expenses", label: "Expenses" },
];

export const SALES_REPORT_TABS = [
  { href: "/admin/reports", label: "Overview" },
  { href: "/admin/reports/sales", label: "Sales" },
  { href: "/admin/reports/products", label: "Products" },
  { href: "/admin/reports/customers", label: "Customers" },
];
