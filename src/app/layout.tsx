import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { SITE } from "@/lib/config";
import { BRAND, brandCssVars } from "@/lib/brand";
import { FONT_CLASS } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: `${SITE.name} — ${SITE.tagline}. Quality fashion for men, women and children.`,
  icons: { icon: BRAND.logo.icon },
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: `${SITE.name} — ${SITE.tagline}.`,
    siteName: SITE.name,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // Active brand profile injected inline (colours + font pointers) so it
      // wins over the stylesheet in both themes — the whole palette and the
      // typefaces derive from these. See src/lib/brand.ts.
      style={brandCssVars()}
      className={`${FONT_CLASS} h-full`}
    >
      {/*
        suppressHydrationWarning on <body> as well: browser extensions
        (ColorZilla, Grammarly and friends) inject attributes such as
        `cz-shortcut-listen` onto the body before React hydrates, which would
        otherwise surface as a hydration mismatch in development.
      */}
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="flex min-h-full flex-col">{children}</div>
          <Toaster position="bottom-right" toastOptions={{ className: "font-sans" }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
