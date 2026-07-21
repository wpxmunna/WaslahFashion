import { PageHeader, Panel } from "@/components/admin/ui";
import {
  ContactSettings,
  GeneralSettings,
  PaymentSettings,
  ShippingSettings,
  SocialSettings,
  type SettingsMap,
} from "@/components/admin/settings-sections";
import { requireAdmin } from "@/lib/admin/guard";
import {
  CURRENCY,
  DEFAULT_SHIPPING_COST,
  DEFAULT_STORE_ID,
  FREE_SHIPPING_THRESHOLD,
  SITE,
} from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "contact", label: "Contact" },
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
  { id: "social", label: "Social" },
];

export default async function AdminSettingsPage() {
  await requireAdmin();

  const rows = await prisma.setting.findMany({
    where: { storeId: DEFAULT_STORE_ID },
    select: { key: true, value: true },
  });

  const values: SettingsMap = {};
  for (const row of rows) {
    if (row.value !== null) values[row.key] = row.value;
  }

  // Seed the general section from code so a fresh install is not blank.
  values.site_name ??= SITE.name;
  values.site_tagline ??= SITE.tagline;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Store-wide configuration. Each section saves independently."
        breadcrumb={[{ href: "/admin", label: "Dashboard" }]}
      />

      <nav aria-label="Settings sections" className="mb-6">
        <ul className="flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-secondary"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-6">
        <GeneralSettings values={values} />
        <ContactSettings values={values} />
        <ShippingSettings
          values={values}
          codeFallbacks={{
            freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
            defaultShippingCost: DEFAULT_SHIPPING_COST,
          }}
        />
        <PaymentSettings values={values} />
        <SocialSettings values={values} />

        <Panel title="Currency" description="Fixed in code — not editable here.">
          <div className="p-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium">Currency code</dt>
                <dd className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {CURRENCY.code}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Display symbol</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{CURRENCY.symbol}</dd>
              </div>
            </dl>
            <p className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              Currency is pinned to BDT in <code>src/lib/config.ts</code>. The legacy app
              stored it per-store and a stale row left prices rendering as mojibake and,
              later, as the wrong currency entirely. Changing it requires a code change and
              a data migration, so it is deliberately read-only.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
