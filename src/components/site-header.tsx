import Image from "next/image";
import Link from "next/link";
import { Heart, Phone, Search, ShoppingBag, User2 } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import { getCartCount } from "@/lib/cart";
import { getCategoryTree } from "@/lib/queries/products";
import { BRAND } from "@/lib/brand";
import { DEFAULT_STORE_ID, SITE } from "@/lib/config";
import { getShippingSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { MobileNav } from "./mobile-nav";
import { AccountMenu } from "./account-menu";
import { SearchField } from "./search-field";

export async function SiteHeader() {
  const [categories, cartCount, user, contactRows, shipping] = await Promise.all([
    getCategoryTree(),
    getCartCount(),
    getCurrentUser(),
    prisma.setting.findMany({
      where: { storeId: DEFAULT_STORE_ID, key: { in: ["business_phone"] } },
      select: { key: true, value: true },
    }),
    getShippingSettings(),
  ]);

  const phone = contactRows.find((r) => r.key === "business_phone")?.value;

  return (
    <header className="sticky top-0 z-50">
      {/* Utility strip */}
      <div className="brand-surface border-b border-white/10">
        <div className="mx-auto flex h-9 max-w-[1400px] items-center justify-between gap-4 px-4 text-[0.7rem] sm:px-6 lg:px-10">
          <p className="truncate tracking-wide">
            Free delivery on orders over {formatPrice(shipping.freeShippingThreshold)}
          </p>
          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="hidden items-center gap-1.5 tracking-wide transition-opacity hover:opacity-80 sm:flex"
            >
              <Phone className="size-3" strokeWidth={1.8} />
              {phone}
            </a>
          )}
        </div>
      </div>

      {/* Main bar — deep green, carrying the logo artwork */}
      <div className="brand-surface">
        <div className="mx-auto flex h-[4.75rem] max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-10">
          <MobileNav categories={categories} />

          <Link href="/" className="shrink-0" aria-label={`${SITE.name} — home`}>
            <Image
              src={BRAND.logo.lockup}
              alt={`${SITE.name} — ${SITE.tagline}`}
              width={1958}
              height={732}
              priority
              className="h-9 w-auto lg:h-11"
            />
          </Link>

          <nav aria-label="Main" className="ml-8 hidden lg:block">
            <ul className="flex items-center gap-7">
              {categories.map((category) => (
                <li key={category.id} className="group relative">
                  <Link
                    href={`/shop/category/${category.slug}`}
                    className="link-wipe py-2 text-[0.8125rem] font-semibold uppercase tracking-[0.08em]"
                  >
                    {category.name}
                  </Link>

                  {category.children.length > 0 && (
                    <div className="invisible absolute left-0 top-full z-50 pt-3 opacity-0 transition-opacity duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      <ul className="min-w-52 rounded-md border border-border bg-popover p-2 shadow-xl">
                        {category.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={`/shop/category/${child.slug}`}
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
              ))}
              <li>
                <Link
                  href="/shop"
                  className="link-wipe py-2 text-[0.8125rem] font-semibold uppercase tracking-[0.08em]"
                >
                  All
                </Link>
              </li>
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <div className="hidden md:block">
              <SearchField onBrand />
            </div>

            <Link
              href="/search"
              aria-label="Search"
              className="grid size-10 place-items-center rounded-md transition-colors hover:bg-white/10 md:hidden"
            >
              <Search className="size-[1.15rem]" strokeWidth={1.7} />
            </Link>

            <Link
              href="/account/wishlist"
              aria-label="Wishlist"
              className="hidden size-10 place-items-center rounded-md transition-colors hover:bg-white/10 sm:grid"
            >
              <Heart className="size-[1.15rem]" strokeWidth={1.7} />
            </Link>

            {user ? (
              <AccountMenu name={user.name} role={user.role} />
            ) : (
              <Link
                href="/login"
                aria-label="Sign in"
                className="grid size-10 place-items-center rounded-md transition-colors hover:bg-white/10"
              >
                <User2 className="size-[1.15rem]" strokeWidth={1.7} />
              </Link>
            )}

            <Link
              href="/cart"
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className="relative grid size-10 place-items-center rounded-md transition-colors hover:bg-white/10"
            >
              <ShoppingBag className="size-[1.15rem]" strokeWidth={1.7} />
              {cartCount > 0 && (
                <span className="absolute right-0.5 top-0.5 grid min-w-[1.15rem] place-items-center rounded-full bg-accent px-1 text-[0.65rem] font-bold tabular-nums text-accent-foreground">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
