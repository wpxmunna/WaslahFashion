"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { CategoryTreeNode } from "@/lib/queries/products";
import { cn } from "@/lib/utils";

const linkClass = "link-wipe block py-2 text-[0.8125rem] font-semibold uppercase tracking-[0.08em]";

/**
 * Desktop primary nav with category dropdowns.
 *
 * Controlled so exactly ONE submenu is ever open. The previous pure-CSS version
 * used `group-focus-within`, which kept a category's menu stuck open whenever
 * its top-level link held focus (e.g. right after clicking it to navigate) —
 * hovering a sibling then opened a second menu and the two overlapped.
 */
export function MainNav({ categories }: { categories: CategoryTreeNode[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openNow(id: number) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(id);
  }
  // Small delay so crossing the gap between a link and its panel doesn't flicker.
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), 90);
  }

  return (
    <nav aria-label="Main" className="ml-8 hidden lg:block">
      <ul className="flex items-center gap-7" onMouseLeave={scheduleClose}>
        {categories.map((category) => {
          const hasChildren = category.children.length > 0;
          const isOpen = open === category.id;
          return (
            <li
              key={category.id}
              className="relative"
              onMouseEnter={() => (hasChildren ? openNow(category.id) : setOpen(null))}
              onFocusCapture={() => (hasChildren ? openNow(category.id) : setOpen(null))}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
              }}
            >
              <Link
                href={`/shop/category/${category.slug}`}
                aria-haspopup={hasChildren || undefined}
                aria-expanded={hasChildren ? isOpen : undefined}
                onClick={() => setOpen(null)}
                className={linkClass}
              >
                {category.name}
              </Link>

              {hasChildren && (
                <div
                  className={cn(
                    "absolute left-0 top-full z-50 pt-3 transition-opacity duration-200",
                    isOpen ? "visible opacity-100" : "pointer-events-none invisible opacity-0",
                  )}
                >
                  <ul className="min-w-52 rounded-md border border-border bg-popover p-2 shadow-xl">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/shop/category/${child.slug}`}
                          onClick={() => setOpen(null)}
                          className="block rounded px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-secondary"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}

        <li>
          <Link href="/shop" className={linkClass}>
            All
          </Link>
        </li>
      </ul>
    </nav>
  );
}
