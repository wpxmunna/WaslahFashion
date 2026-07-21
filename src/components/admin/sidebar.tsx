"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChartColumn,
  Images,
  LayoutDashboard,
  Menu,
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

export function AdminSidebar({ isFullAdmin }: { isFullAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const nav = (
    <nav aria-label="Admin" className="space-y-6 px-3 pb-10">
      {NAV.map((section) => {
        const items = section.items.filter((i) => !i.adminOnly || isFullAdmin);
        if (items.length === 0) return null;

        const Icon = ICONS[section.icon] ?? LayoutDashboard;

        return (
          <div key={section.title}>
            <p className="flex items-center gap-2 px-2 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">
              <Icon className="size-3.5" strokeWidth={1.8} />
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-white/15 font-medium text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        className="fixed bottom-5 right-5 z-50 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
      >
        <Menu className="size-5" strokeWidth={1.8} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "brand-surface fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <Link href="/admin" className="block">
            <Image
              src="/brand/waslah-wordmark.png"
              alt="Waslah admin"
              width={1958}
              height={580}
              className="h-6 w-auto"
            />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close admin menu"
            className="grid size-8 place-items-center rounded-md text-white/70 hover:bg-white/10 lg:hidden"
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        </div>

        {nav}
      </aside>
    </>
  );
}
