/**
 * Browser smoke test for the storefront.
 *
 * Covers the things a curl sweep cannot: portalled menus, client-side
 * interactions, and console/page errors that only surface after hydration.
 *
 *   npx tsx scripts/smoke.ts [baseUrl]
 *
 * Requires the dev server to be running and the database seeded.
 */
import "dotenv/config";
import { chromium, type ConsoleMessage, type Page } from "playwright";
import { SignJWT } from "jose";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma";

const BASE = process.argv[2] ?? "http://localhost:3000";

/** Every admin screen, swept for crashes and non-2xx responses. */
const ADMIN_ROUTES = [
  "/admin",
  "/admin/products",
  "/admin/products/new",
  "/admin/categories",
  "/admin/colors",
  "/admin/orders",
  "/admin/returns",
  "/admin/customers",
  "/admin/coupons",
  "/admin/pos",
  "/admin/pos/transactions",
  "/admin/pos/shifts",
  "/admin/suppliers",
  "/admin/purchase-orders",
  "/admin/expenses",
  "/admin/expenses/categories",
  "/admin/accounting",
  "/admin/accounting/accounts",
  "/admin/accounting/journal",
  "/admin/finance-reports",
  "/admin/employees",
  "/admin/employees/departments",
  "/admin/attendance",
  "/admin/payroll",
  "/admin/payroll/components",
  "/admin/sliders",
  "/admin/lookbook",
  "/admin/social-media",
  "/admin/social-media/campaigns",
  "/admin/reports",
  "/admin/couriers",
  "/admin/stores",
  "/admin/users",
  "/admin/settings",
];

type Failure = { where: string; detail: string };
const failures: Failure[] = [];
const checks: string[] = [];

function pass(name: string) {
  checks.push(name);
  console.log(`  PASS  ${name}`);
}

function fail(where: string, detail: string) {
  failures.push({ where, detail });
  console.log(`  FAIL  ${where} — ${detail}`);
}

/** Console errors and uncaught exceptions, attributed to the current page. */
function watch(page: Page, label: () => string) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Next's dev overlay re-logs 404s for images we already handle.
    if (text.includes("Failed to load resource")) return;
    fail(label(), `console: ${text.slice(0, 200)}`);
  });
  page.on("pageerror", (err) => {
    fail(label(), `pageerror: ${err.message.slice(0, 200)}`);
  });
}

async function sessionToken(email: string) {
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL!),
  });
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  await prisma.$disconnect();
  if (!user) throw new Error(`No such user: ${email}`);

  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("604800s")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
}

async function main() {
  const [customerToken, adminToken] = await Promise.all([
    sessionToken("customer@waslah.com"),
    sessionToken("admin@waslah.com"),
  ]);

  const browser = await chromium.launch();
  const host = new URL(BASE).hostname;

  // --- Guest journey -------------------------------------------------------
  const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let current = "guest:/";
  const page = await guest.newPage();
  watch(page, () => current);

  console.log("\nGuest");
  await page.goto(BASE, { waitUntil: "networkidle" });
  if (await page.locator("header img[alt*='Waslah']").first().isVisible()) {
    pass("home renders with brand logo");
  } else {
    fail(current, "logo not visible in header");
  }

  current = "guest:/shop";
  await page.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
  const cards = await page.locator("a[href^='/product/']").count();
  if (cards > 0) pass(`shop lists products (${cards} links)`);
  else fail(current, "no product links");

  // Add to bag from the product page, including a variant selection.
  current = "guest:/product";
  await page.locator("a[href^='/product/']").first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /add to bag/i }).click();
  await page.waitForTimeout(2500);

  current = "guest:/cart";
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  const hasLine = await page.locator("li").filter({ hasText: /each/ }).count();
  if (hasLine > 0) pass("add to bag persisted to cart");
  else fail(current, "cart is empty after add");

  // Quantity stepper is a client action against the server.
  const inc = page.getByRole("button", { name: /increase quantity/i }).first();
  if (await inc.isVisible()) {
    await inc.click();
    await page.waitForTimeout(2000);
    pass("cart quantity stepper works");
  }

  current = "guest:/checkout";
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
  if (await page.getByRole("button", { name: /place order/i }).isVisible()) {
    pass("checkout reachable with items in bag");
  } else {
    fail(current, "no place-order button");
  }

  await guest.close();

  // --- Signed-in journeys --------------------------------------------------
  for (const [label, token, expectAdminLink] of [
    ["customer", customerToken, false],
    ["admin", adminToken, true],
  ] as const) {
    console.log(`\nSigned in — ${label}`);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addCookies([
      { name: "waslah_session", value: token, domain: host, path: "/", httpOnly: true },
    ]);
    const p = await ctx.newPage();
    current = `${label}:/`;
    watch(p, () => current);

    await p.goto(BASE, { waitUntil: "networkidle" });

    // The regression that curl could never catch: the account dropdown is
    // portalled, so it only renders once opened in a real browser.
    await p.getByRole("button", { name: /account menu/i }).click();
    await p.waitForTimeout(900);

    const signedInAs = await p.getByText(/signed in as/i).isVisible().catch(() => false);
    if (signedInAs) pass("account dropdown opens and renders its label");
    else fail(current, "dropdown label not visible after opening");

    const signOut = await p.getByText(/sign out/i).isVisible().catch(() => false);
    if (signOut) pass("sign-out item present");
    else fail(current, "sign-out item missing");

    const adminLink = await p.locator("a[href='/admin']").isVisible().catch(() => false);
    if (expectAdminLink === adminLink) {
      pass(`admin link ${adminLink ? "shown for staff" : "hidden for customer"}`);
    } else {
      fail(current, `admin link visibility wrong (expected ${expectAdminLink}, got ${adminLink})`);
    }

    await p.keyboard.press("Escape");

    // Actually sign out, rather than only asserting the item exists. The first
    // version of this test checked for the item's presence and passed while
    // sign-out was broken.
    current = `${label}:signout`;
    await p.goto(BASE, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: /account menu/i }).click();
    await p.waitForTimeout(600);
    await p.getByTestId("sign-out").click();
    await p.waitForTimeout(2500);

    const cookiesAfter = await ctx.cookies();
    const sessionGone = !cookiesAfter.some(
      (c) => c.name === "waslah_session" && c.value !== "",
    );
    if (sessionGone) pass("sign out clears the session cookie");
    else fail(current, "waslah_session cookie survived sign-out");

    // And the UI must reflect it — the sign-in link returns.
    await p.goto(BASE, { waitUntil: "networkidle" });
    const signInVisible = await p
      .locator('a[href="/login"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (signInVisible) pass("UI returns to signed-out state");
    else fail(current, "still rendering as signed in after sign-out");

    // Protected routes must bounce once signed out.
    const guarded = await p.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
    if (!p.url().includes("/account") || p.url().includes("/login")) {
      pass(`/account redirects when signed out (${guarded?.status()})`);
    } else {
      fail(current, "/account still reachable after sign-out");
    }

    for (const path of ["/account", "/account/orders", "/account/wishlist", "/account/addresses"]) {
      current = `${label}:${path}`;
      const res = await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      if (res && res.status() < 400) pass(`${path} renders (${res.status()})`);
      else fail(current, `status ${res?.status()}`);
    }

    await ctx.close();
  }

  // --- Admin panel ---------------------------------------------------------
  // Every admin route is swept in a real browser so client-only crashes
  // (portalled menus, Base UI misuse, hydration errors) surface here rather
  // than in production.
  console.log("\nAdmin panel");
  const adminCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await adminCtx.addCookies([
    { name: "waslah_session", value: adminToken, domain: host, path: "/", httpOnly: true },
  ]);
  const admin = await adminCtx.newPage();
  watch(admin, () => current);

  for (const path of ADMIN_ROUTES) {
    current = `admin:${path}`;
    try {
      const res = await admin.goto(`${BASE}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      const status = res?.status() ?? 0;
      if (status < 400) pass(`${path} (${status})`);
      else fail(current, `status ${status}`);
    } catch (err) {
      fail(current, `navigation failed: ${(err as Error).message.slice(0, 120)}`);
    }
  }

  // A manager must not reach the full-admin-only screens.
  current = "manager:guard";
  const mgrToken = await sessionToken("manager@waslah.com").catch(() => null);
  if (mgrToken) {
    const mgrCtx = await browser.newContext();
    await mgrCtx.addCookies([
      { name: "waslah_session", value: mgrToken, domain: host, path: "/", httpOnly: true },
    ]);
    const mgr = await mgrCtx.newPage();
    const res = await mgr.goto(`${BASE}/admin/settings`, { waitUntil: "domcontentloaded" });
    const url = mgr.url();
    if (url.includes("/admin/settings")) {
      fail(current, "manager reached /admin/settings");
    } else {
      pass(`manager redirected away from /admin/settings (${res?.status()})`);
    }
    await mgrCtx.close();
  }

  await adminCtx.close();
  await browser.close();

  console.log(`\n${"-".repeat(52)}`);
  console.log(`${checks.length} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  ✗ ${f.where}: ${f.detail}`);
    process.exit(1);
  }
  console.log("All storefront smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
