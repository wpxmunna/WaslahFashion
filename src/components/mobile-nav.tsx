"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CategoryTreeNode } from "@/lib/queries/products";

export function MobileNav({ categories }: { categories: CategoryTreeNode[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="-ml-2 grid size-10 place-items-center transition-colors hover:text-primary lg:hidden"
      >
        <Menu className="size-5" strokeWidth={1.6} />
      </SheetTrigger>

      <SheetContent side="left" className="w-[19rem] p-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="font-display text-xl">Browse</SheetTitle>
        </SheetHeader>

        <nav className="overflow-y-auto px-6 py-5">
          <ul className="space-y-6">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/shop/category/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="font-display text-lg"
                >
                  {category.name}
                </Link>
                {category.children.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-l pl-4">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/shop/category/${child.slug}`}
                          onClick={() => setOpen(false)}
                          className="block py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}

            <li className="border-t pt-5">
              <Link
                href="/shop"
                onClick={() => setOpen(false)}
                className="font-display text-lg"
              >
                All products
              </Link>
            </li>
            <li>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="font-display text-lg"
              >
                My account
              </Link>
            </li>
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
