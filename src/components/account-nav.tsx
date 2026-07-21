"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account">
      <ul className="flex gap-4 overflow-x-auto border-b border-border pb-3 lg:flex-col lg:gap-1 lg:border-b-0 lg:pb-0">
        {LINKS.map((link) => {
          // Exact match for the overview so it doesn't stay lit on subpages.
          const active =
            link.href === "/account"
              ? pathname === "/account"
              : pathname.startsWith(link.href);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap py-2 text-sm transition-colors lg:border-l-2 lg:pl-3",
                  active
                    ? "text-foreground lg:border-foreground"
                    : "text-muted-foreground hover:text-foreground lg:border-transparent",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
