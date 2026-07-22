import Image from "next/image";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/brand";
import { DEFAULT_STORE_ID, SITE } from "@/lib/config";
import { getCategoryTree } from "@/lib/queries/products";
import { ThemeToggle } from "./theme-toggle";

async function getFooterData() {
  const [categories, socials, settings] = await Promise.all([
    getCategoryTree(),
    prisma.socialLink.findMany({
      where: { storeId: DEFAULT_STORE_ID, isActive: true, showInFooter: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, url: true, openNewTab: true },
    }),
    prisma.setting.findMany({
      where: { storeId: DEFAULT_STORE_ID, group: "contact" },
      select: { key: true, value: true },
    }),
  ]);

  const contact = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return { categories, socials, contact };
}

export async function SiteFooter() {
  const { categories, socials, contact } = await getFooterData();

  return (
    <footer className="brand-surface mt-24">
      <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Image
              src={BRAND.logo.lockup}
              alt={`${SITE.name} — ${SITE.tagline}`}
              width={1958}
              height={732}
              className="h-14 w-auto"
            />
            <p className="mt-6 text-sm leading-relaxed text-current/75">
              We buy directly from the weavers and makers whose work you see here,
              and we tell you who they are.
            </p>

            {socials.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                {socials.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      className="link-wipe kicker text-current/75 transition-colors hover:text-current"
                      {...(s.openNewTab
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {s.name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <nav aria-label="Shop">
            <h2 className="kicker text-[color:var(--accent)]">Shop</h2>
            <ul className="mt-4 space-y-2.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/shop/category/${c.slug}`}
                    className="link-wipe text-sm text-current/80 transition-colors hover:text-current"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/shop"
                  className="link-wipe text-sm text-current/80 transition-colors hover:text-current"
                >
                  All products
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className="kicker text-[color:var(--accent)]">Account</h2>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: "/account", label: "My account" },
                { href: "/account/orders", label: "Order history" },
                { href: "/account/wishlist", label: "Wishlist" },
                { href: "/cart", label: "Your bag" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="link-wipe text-sm text-current/80 transition-colors hover:text-current"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="kicker text-[color:var(--accent)]">Contact</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-current/80">
              {contact.business_address && (
                <li className="leading-relaxed">{contact.business_address}</li>
              )}
              {contact.business_phone && (
                <li>
                  <a
                    href={`tel:${contact.business_phone.replace(/\s/g, "")}`}
                    className="link-wipe transition-colors hover:text-current"
                  >
                    {contact.business_phone}
                  </a>
                </li>
              )}
              {contact.business_email && (
                <li>
                  <a
                    href={`mailto:${contact.business_email}`}
                    className="link-wipe transition-colors hover:text-current"
                  >
                    {contact.business_email}
                  </a>
                </li>
              )}
              {contact.business_hours && <li>{contact.business_hours}</li>}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col-reverse items-start gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-current/65">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
