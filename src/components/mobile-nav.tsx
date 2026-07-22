"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CategoryTreeNode } from "@/lib/queries/products";

export function MobileNav({ categories }: { categories: CategoryTreeNode[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer once navigation lands on a new route. This must NOT happen
  // in each link's onClick: the Sheet unmounts its portalled content the moment
  // it closes, which cancels the <Link> navigation before it can start (the bug
  // where tapping a link neither navigated nor closed the menu).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
                <Link href={`/shop/category/${category.slug}`} className="font-display text-lg">
                  {category.name}
                </Link>
                {category.children.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-l pl-4">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/shop/category/${child.slug}`}
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
              <Link href="/shop" className="font-display text-lg">
                All products
              </Link>
            </li>
            <li>
              <Link href="/account" className="font-display text-lg">
                My account
              </Link>
            </li>
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
