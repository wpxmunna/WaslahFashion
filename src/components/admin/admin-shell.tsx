"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChartColumn,
  ChevronDown,
  ExternalLink,
  Images,
  LayoutDashboard,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Settings,
  Shirt,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import { NAV } from "./nav-config";
import { AccountMenu } from "@/components/account-menu";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Shirt,
  ShoppingCart,
  Store,
  Truck,
  Wallet,
  Users,
  Images,
  ChartColumn,
  Settings,
};

const COLLAPSE_KEY = "admin.sidebarCollapsed";
const CLOSED_KEY = "admin.closedSections";

type Props = {
  user: { name: string; role: "CUSTOMER" | "MANAGER" | "ADMIN" };
  isFullAdmin: boolean;
  children: React.ReactNode;
};

/**
 * Admin frame. Owns the two collapse behaviours the sidebar needs:
 *  - the whole sidebar collapses to a slim icon rail (desktop), which also
 *    reclaims the content width;
 *  - each category collapses like an accordion.
 * Both states persist in localStorage so they survive navigation.
 */
export function AdminShell({ user, isFullAdmin, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false); // desktop icon rail
  const [open, setOpen] = useState(false); // mobile drawer
  const [closed, setClosed] = useState<Set<string>>(new Set()); // closed categories
  const [ready, setReady] = useState(false); // suppress first-paint animation

  // Restore persisted UI state after mount. This deliberately runs after
  // hydration (not during render): the server has no localStorage, so reading
  // it during render would make the sidebar's width/padding classes differ
  // between server and client and trigger a hydration mismatch. The state is
  // set once here, so the cascading-render warning does not apply.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLOSED_KEY);
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
      if (raw) setClosed(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* private mode / disabled storage — keep defaults */
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function persistCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function toggleSection(title: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      try {
        localStorage.setItem(CLOSED_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sections = NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.adminOnly || isFullAdmin),
  })).filter((s) => s.items.length > 0);

  // --- Full nav: accordion categories (mobile drawer + expanded desktop) ----
  const fullNav = (
    <nav aria-label="Admin" className="space-y-1 px-3 pb-10">
      {sections.map((section) => {
        const Icon = ICONS[section.icon] ?? LayoutDashboard;
        const isClosed = closed.has(section.title);
        return (
          <div key={section.title}>
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              aria-expanded={!isClosed}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]/85 transition-colors hover:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-3.5" strokeWidth={2} />
                {section.title}
              </span>
              <ChevronDown
                className={cn("size-3.5 transition-transform duration-200", isClosed && "-rotate-90")}
                strokeWidth={2}
              />
            </button>

            {!isClosed && (
              <ul className="mt-0.5 space-y-0.5 pb-1">
                {section.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative block rounded-md py-2 pl-9 pr-3 text-sm transition-colors",
                          active
                            ? "bg-white/12 font-semibold text-white before:absolute before:left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[var(--accent)]"
                            : "text-white/70 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  // --- Icon rail: collapsed desktop. A category icon expands the sidebar -----
  //     and opens that category.
  const railNav = (
    <nav aria-label="Admin" className="flex flex-col items-center gap-1 px-2 pb-10">
      {sections.map((section) => {
        const Icon = ICONS[section.icon] ?? LayoutDashboard;
        const hasActive = section.items.some((i) => isActive(i.href, i.exact));
        return (
          <button
            key={section.title}
            type="button"
            title={section.title}
            aria-label={`${section.title} — expand menu`}
            onClick={() => {
              if (closed.has(section.title)) toggleSection(section.title);
              persistCollapsed(false);
            }}
            className={cn(
              "grid size-11 place-items-center rounded-md transition-colors",
              hasActive
                ? "bg-white/12 text-[color:var(--accent)]"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-5" strokeWidth={1.9} />
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Mobile scrim */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "brand-surface fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto overflow-x-hidden",
          ready && "transition-[transform,width] duration-300",
          collapsed ? "lg:w-[4.75rem]" : "lg:w-64",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-5",
            collapsed ? "justify-between lg:justify-center lg:px-2" : "justify-between",
          )}
        >
          {/* Full wordmark (expanded) */}
          <Link href="/admin" className={cn("block", collapsed && "lg:hidden")}>
            <Image
              src={BRAND.logo.wordmark}
              alt={`${BRAND.name} admin`}
              width={1958}
              height={580}
              className="h-6 w-auto"
            />
          </Link>
          {/* Square mark (collapsed rail) */}
          {collapsed && (
            <Link href="/admin" className="hidden lg:block" aria-label={`${BRAND.name} admin`}>
              <Image src={BRAND.logo.icon} alt="" width={512} height={512} className="size-7" />
            </Link>
          )}

          {/* Desktop collapse toggle (hidden once collapsed — reopened from the header) */}
          <button
            type="button"
            onClick={() => persistCollapsed(true)}
            aria-label="Collapse sidebar"
            className={cn(
              "hidden size-8 place-items-center rounded-md text-white/70 transition-colors hover:bg-white/10 lg:grid",
              collapsed && "lg:hidden",
            )}
          >
            <PanelLeftClose className="size-4" strokeWidth={1.9} />
          </button>

          {/* Mobile close */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid size-8 place-items-center rounded-md text-white/70 hover:bg-white/10 lg:hidden"
          >
            <X className="size-4" strokeWidth={1.9} />
          </button>
        </div>

        {/* Mobile always shows the full accordion nav */}
        <div className="lg:hidden">{fullNav}</div>
        {/* Desktop shows the rail or the full nav depending on collapse */}
        <div className="hidden lg:block">{collapsed ? railNav : fullNav}</div>
      </aside>

      <div
        className={cn(
          ready && "transition-[padding] duration-300",
          collapsed ? "lg:pl-[4.75rem]" : "lg:pl-64",
        )}
      >
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              {/* Mobile: open drawer */}
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
              >
                <Menu className="size-5" strokeWidth={1.8} />
              </button>

              {/* Desktop: expand when collapsed */}
              {collapsed && (
                <button
                  type="button"
                  onClick={() => persistCollapsed(false)}
                  aria-label="Expand sidebar"
                  className="hidden size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:grid"
                >
                  <PanelLeft className="size-5" strokeWidth={1.8} />
                </button>
              )}

              <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <span className="truncate">{user.name}</span>
                <span className="shrink-0 rounded bg-accent/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-accent-foreground">
                  {user.role.toLowerCase()}
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Link
                href="/"
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <span className="hidden sm:inline">View store</span>
                <ExternalLink className="size-3.5" strokeWidth={1.7} />
              </Link>
              <div className="text-foreground">
                <AccountMenu name={user.name} role={user.role} />
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
