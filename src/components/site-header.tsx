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
import { MainNav } from "./main-nav";
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

          <MainNav categories={categories} />

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
