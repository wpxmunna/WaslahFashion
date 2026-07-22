/**
 * Admin navigation map — one entry per legacy admin controller.
 * `adminOnly` mirrors the legacy `requireFullAdmin()` screens that managers
 * were locked out of.
 */
export type NavItem = {
  href: string;
  label: string;
  adminOnly?: boolean;
  /** Match child routes too (e.g. /admin/products/create). */
  exact?: boolean;
};

export type NavSection = {
  title: string;
  icon: string;
  items: NavItem[];
};

export const NAV: NavSection[] = [
  {
    title: "Overview",
    icon: "LayoutDashboard",
    items: [{ href: "/admin", label: "Dashboard", exact: true }],
  },
  {
    title: "Catalogue",
    icon: "Shirt",
    items: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/categories", label: "Categories" },
      { href: "/admin/colors", label: "Colours" },
      { href: "/admin/size-charts", label: "Size charts" },
    ],
  },
  {
    title: "Sales",
    icon: "ShoppingCart",
    items: [
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/returns", label: "Returns" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/coupons", label: "Coupons" },
    ],
  },
  {
    title: "Point of sale",
    icon: "Store",
    items: [
      { href: "/admin/pos", label: "Terminal", exact: true },
      { href: "/admin/pos/transactions", label: "Transactions" },
      { href: "/admin/pos/shifts", label: "Shifts" },
    ],
  },
  {
    title: "Purchasing",
    icon: "Truck",
    items: [
      { href: "/admin/suppliers", label: "Suppliers" },
      { href: "/admin/purchase-orders", label: "Purchase orders" },
    ],
  },
  {
    title: "Finance",
    icon: "Wallet",
    items: [
      { href: "/admin/expenses", label: "Expenses" },
      { href: "/admin/accounting", label: "Accounting", adminOnly: true },
      { href: "/admin/finance-reports", label: "Financial reports", adminOnly: true },
    ],
  },
  {
    title: "People",
    icon: "Users",
    items: [
      { href: "/admin/employees", label: "Employees" },
      { href: "/admin/attendance", label: "Attendance" },
      { href: "/admin/payroll", label: "Payroll", adminOnly: true },
    ],
  },
  {
    title: "Content",
    icon: "Images",
    items: [
      { href: "/admin/sliders", label: "Sliders" },
      { href: "/admin/lookbook", label: "Lookbook" },
      { href: "/admin/social-media", label: "Social links", exact: true },
      { href: "/admin/social-media/campaigns", label: "Campaigns" },
    ],
  },
  {
    title: "Reports",
    icon: "ChartColumn",
    items: [{ href: "/admin/reports", label: "Sales reports" }],
  },
  {
    title: "Configuration",
    icon: "Settings",
    items: [
      { href: "/admin/couriers", label: "Couriers" },
      { href: "/admin/stores", label: "Stores", adminOnly: true },
      { href: "/admin/users", label: "Staff", adminOnly: true },
      { href: "/admin/settings", label: "Settings", adminOnly: true },
    ],
  },
];
