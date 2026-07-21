# Waslah Fashion

Next.js 16 + TypeScript rewrite of the legacy PHP e-commerce/ERP portal
(`E:\WaslahEcomPortal`).

- **Framework** — Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Data** — MySQL 8 via Prisma 7 (driver adapter: `@prisma/adapter-mariadb`)
- **UI** — Tailwind CSS 4 + shadcn/ui (Base UI primitives)
- **Auth** — self-hosted sessions: `jose` JWT in an httpOnly cookie, bcrypt (cost 12)
- **Currency** — BDT throughout

## Getting started

```bash
docker compose up -d          # MySQL 8 on host port 3307
cp .env.example .env          # then set AUTH_SECRET
npm install
npx prisma migrate dev        # create the schema
npx prisma db seed            # demo catalogue, users, sliders, coupons
npm run dev                   # http://localhost:3000
```

Seeded logins:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@waslah.com` | `admin1234` |
| Customer | `customer@waslah.com` | `customer1234` |

Port 3307 is deliberate so this runs alongside the legacy stack on 3306.

## Migrating the legacy data

`scripts/migrate-legacy-data.ts` copies all 63 live tables from the old
`waslah_ecom` database into the new schema, preserving primary keys so every
foreign key survives.

```bash
# point LEGACY_DATABASE_URL at the old database first
npm run migrate:data            # idempotent; skips duplicates
npm run migrate:data -- --fresh # truncate targets first
```

It prints a per-table summary of rows read/written/skipped. Review the mapping
notes in the file header before a production run.

## Project layout

```
prisma/schema.prisma      Clean redesign of the 64-table legacy schema
prisma/seed.ts            Demo data
scripts/                  Legacy data migration
src/actions/              Server actions (auth, cart, checkout, wishlist)
src/lib/                  prisma client, auth, cart, coupons, money, config
src/lib/queries/          Read models
src/components/           UI, incl. src/components/ui (shadcn)
src/app/(storefront)/     Customer-facing routes
```

## Schema changes from the legacy database

The rewrite is a clean redesign rather than a lift-and-shift:

- `banners` dropped — dead table, superseded by `sliders`.
- `stores.currency_code` / `currency_symbol` dropped — dead since the currency
  cleanup; BDT now lives in `src/lib/config.ts`.
- `settings` + `business_settings` merged into one `Setting` model with a `group`.
- `orders.shipping_address` / `shipping_zip` collapsed into the
  `line1 / line2 / postalCode` block they duplicated.
- Guest carts keyed by a durable `token` cookie instead of the PHP session id.
- String/tinyint statuses became proper Prisma enums; money is `Decimal(12,2)`.

## Legacy defects fixed rather than ported

Behaviour was matched deliberately except where the original was wrong:

1. Shop page collected `min_price`/`max_price` and never applied them.
2. `name_asc` / `name_desc` silently fell back to `created_at` on category pages.
3. Guest header cart count always rendered `0`.
4. Guest carts were lost on login — the merge ran after the session id was
   regenerated, so it looked up the wrong key.
5. `/cart/update` and `/cart/remove` accepted any item id (IDOR).
6. Checkout validated no address, phone, or payment method.
7. Payment gateway results were ignored — a declined card still produced a
   "successful" order. Orders now stay `PENDING` until a gateway confirms.
8. Stock decrement had no `>= quantity` guard, so concurrent orders drove stock
   negative. Now a conditional `updateMany` that fails closed.
9. Out-of-stock messages read a field that didn't exist, rendering blank names.
10. `/order/track` and guest order pages had no ownership check at all.
11. `sale_price = 0.00` was treated as a valid free sale price.
12. `getRelated` used `ORDER BY RAND()`.
13. `buy_x_get_y` coupons were a stub that never granted anything — now implemented.
14. bcrypt cost was inconsistent (12 in one path, 10 in another).
15. Empty carts were charged the flat 80 BDT shipping fee.

## A Prisma 7 gotcha worth remembering

Interpolating a `Prisma.Sql` (e.g. from `Prisma.join`) directly into a
`$queryRaw` **tagged template** binds it as a query *parameter* instead of
splicing it in as SQL — producing a WHERE clause that matches nothing, with no
error. Compose with `Prisma.sql\`...\`` and pass the finished object to
`$queryRaw(query)`. See `src/lib/queries/products.ts`.

## Verification

```bash
npm run dev      # in one terminal
npm run smoke    # drives a real browser: storefront journey + all admin routes
```

`npm run smoke` (Playwright) is the meaningful check. It signs in as each role via a
minted session cookie, walks guest browse → add to bag → cart → checkout, opens the
portalled account menu, sweeps all 34 admin screens, and asserts a manager is redirected
away from full-admin pages. **It fails on any console error or uncaught exception**, which
route-level status codes alone will not catch — a page can return 200 while its menu
crashes on click.

Also run `npx tsc --noEmit` and `npx eslint src` before committing. Neither catches the
server/client boundary bug described in `docs/ADMIN_CONVENTIONS.md`; only the smoke test
and a real page load do.

## Status

**Storefront — done.** Home, shop, category, search, product detail, cart, checkout,
order confirmation, order tracking, login/register, wishlist, and account (overview,
orders, addresses, wishlist).

**Admin panel — done.** 34 screens across every legacy controller: dashboard, products
(images + variants), categories, colours, orders (+ invoice), returns, customers,
coupons, POS (terminal, shifts, transactions, receipts, refunds), suppliers, purchase
orders (with stock receipt), expenses, chart of accounts, journal entries, financial
reports (P&L, cash flow, expenses), sales reports, employees, attendance, payroll
(+ payslips), sliders, lookbook, social links, campaigns, couriers, stores, staff and
settings. Reports export to CSV.

Roles: `ADMIN` sees everything; `MANAGER` reaches the panel but is blocked from
accounting, financial reports, payroll, stores, staff and settings.

## Known gaps and decisions to make

These are deliberate omissions, not oversights:

- **Pathao courier integration is not ported.** It needs its own model and service. Note
  the legacy `forceEnable()` is an unguarded state-changing GET and its sandbox
  credentials are hardcoded — neither should be carried over.
- **Multi-store switching.** Everything scopes to the default store. Legacy kept the
  active store in the session and wrote to a mismatched key, so it was already broken.
- **Overtime rate.** Payroll uses `basicSalary / 208` with **no 1.5× multiplier**; the
  legacy app applied 1.5×. Confirm which is correct — it changes every payslip.
- **COGS uses each product's *current* `costPrice`**, since `order_items` has no cost
  snapshot. Restating a cost restates history. Fixing it needs a schema column.
- **Receiving stock does not update `costPrice`.** Legacy overwrote it with the last
  received unit cost, which a one-unit receipt could distort. A weighted average is the
  better answer but is unimplemented.
- **Campaign view/click tracking has no public endpoint** — counters only move via the
  admin copy action. The legacy endpoint was unauthenticated and trivially inflatable.
- **POS sells base products, not variants.** The data model and stock decrement handle
  variants throughout; only the terminal's product grid lacks a variant picker.
- **Partial POS refunds leave the transaction `COMPLETED`** (the amount shows in
  `refundedAmount`). A `PARTIAL_REFUND` status would need a schema change.
- **Print views** (invoice, receipt, payslip) overlay the admin chrome rather than using
  a separate route group. Functional, but a `(print)` group would be cleaner.
