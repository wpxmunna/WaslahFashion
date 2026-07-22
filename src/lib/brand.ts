/**
 * Brand profiles — white-label the whole site by name.
 *
 * Each profile bundles a colour palette, a font pairing and a logo set. Define
 * as many as you deploy for in `BRAND_PROFILES` below, then pick the live one
 * with a SINGLE line in `.env`:
 *
 *     NEXT_PUBLIC_BRAND_PROFILE="waslah"
 *
 * That name flows through the whole site — storefront and admin — recolouring
 * every branded surface, swapping the fonts and the logos. No other change is
 * needed to re-skin for a different fashion brand.
 *
 * Individual values can still be overridden per-deployment without editing a
 * profile, via NEXT_PUBLIC_BRAND_PRIMARY / _ACCENT / _LOGO_* (they win over the
 * active profile). Fonts are loaded in src/app/fonts.ts — a profile's font keys
 * must exist in FONT_STACK below (and be loaded there).
 */
import type { CSSProperties } from "react";

import { SITE } from "./config";

/**
 * Font pairing keys → the CSS variable each font is registered under in
 * `src/app/fonts.ts`. Add a font there and here to make it selectable.
 * (Kept as plain strings so this module never imports `next/font`, which must
 * not enter the client bundle.)
 */
export const FONT_STACK = {
  bricolage: "var(--font-bricolage)",
  instrument: "var(--font-instrument)",
  fraunces: "var(--font-fraunces)",
  syne: "var(--font-syne)",
  manrope: "var(--font-manrope)",
  playfair: "var(--font-playfair)",
} as const;

export type FontKey = keyof typeof FONT_STACK;

export type BrandProfile = {
  /** Display name of the brand. */
  name: string;
  /** Dominant colour — header/footer/sidebar plate, primary buttons. Any CSS colour. */
  primary: string;
  /** Highlight colour — CTAs, badges, rules, active accents. */
  accent: string;
  /** Display + body typefaces, referenced by FONT_STACK key. */
  fonts: { display: FontKey; body: FontKey };
  /** Logo asset paths (under /public). Supply transparent-background art. */
  logo: { lockup: string; wordmark: string; icon: string };
};

const WASLAH_LOGOS = {
  lockup: "/brand/waslah-lockup.png",
  wordmark: "/brand/waslah-wordmark.png",
  // Tight square mark (no tagline) — legible as a favicon / app icon.
  icon: "/brand/waslah-icon.png",
};

/** All available brand profiles, keyed by their `.env` name (lower-case). */
export const BRAND_PROFILES: Record<string, BrandProfile> = {
  waslah: {
    name: "Waslah",
    primary: "#14423B", // deep heritage green
    accent: "#D4AF37", // gold
    fonts: { display: "bricolage", body: "instrument" },
    logo: WASLAH_LOGOS,
  },

  // --- Example profiles: copy one, rename the key, drop in the brand's -------
  //     colours, fonts and logos. The key is what goes in NEXT_PUBLIC_BRAND_PROFILE.
  noir: {
    name: "Noir",
    primary: "#161616", // near-black
    accent: "#C8A24B", // antique gold
    fonts: { display: "fraunces", body: "manrope" },
    logo: WASLAH_LOGOS, // replace with the brand's own logo set
  },

  rosewood: {
    name: "Rosewood",
    primary: "#3B1E54", // deep plum
    accent: "#E0A458", // warm amber
    fonts: { display: "syne", body: "manrope" },
    logo: WASLAH_LOGOS, // replace with the brand's own logo set
  },
};

export const DEFAULT_PROFILE = "waslah";

/** The profile named in `.env`, falling back to the default if unset/unknown. */
export const ACTIVE_PROFILE_KEY: string = (() => {
  const key = process.env.NEXT_PUBLIC_BRAND_PROFILE?.trim().toLowerCase();
  return key && key in BRAND_PROFILES ? key : DEFAULT_PROFILE;
})();

const profile = BRAND_PROFILES[ACTIVE_PROFILE_KEY];

function env(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : fallback;
}

/**
 * The resolved live brand — the active profile, with optional per-value
 * environment overrides layered on top. Import this everywhere.
 */
export const BRAND = {
  profile: ACTIVE_PROFILE_KEY,
  name: profile.name || SITE.name,
  primary: env("NEXT_PUBLIC_BRAND_PRIMARY", profile.primary),
  accent: env("NEXT_PUBLIC_BRAND_ACCENT", profile.accent),
  fonts: profile.fonts,
  logo: {
    lockup: env("NEXT_PUBLIC_BRAND_LOGO_LOCKUP", profile.logo.lockup),
    wordmark: env("NEXT_PUBLIC_BRAND_LOGO_WORDMARK", profile.logo.wordmark),
    icon: env("NEXT_PUBLIC_BRAND_LOGO_ICON", profile.logo.icon),
  },
} as const;

const DARK_TEXT = "#141414";
const LIGHT_TEXT = "#ffffff";

/**
 * Choose near-black or white text for legibility on a background colour, by
 * whichever gives the higher WCAG contrast ratio. Unparseable formats fall back
 * to white, which suits the typically-dark brand primary.
 *
 * (A previous version used a plain `luminance > 0.45` threshold. Gold #D4AF37
 * sits at luminance ~0.449 — just under it — so it wrongly picked white,
 * turning `--accent-foreground` white and hiding accent-coloured text on light
 * surfaces. Comparing contrast against both fixes that class of bug.)
 */
export function readableText(background: string): string {
  const rgb = parseColor(background);
  if (!rgb) return LIGHT_TEXT;
  const bg = relativeLuminance(rgb);
  const dark = relativeLuminance([20, 20, 20]); // #141414
  const contrastDark = (bg + 0.05) / (dark + 0.05);
  const contrastLight = (1 + 0.05) / (bg + 0.05);
  return contrastDark >= contrastLight ? DARK_TEXT : LIGHT_TEXT;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function parseColor(input: string): [number, number, number] | null {
  const hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const m = input.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[,/\s]+/).map((p) => parseFloat(p));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => !Number.isNaN(n))) {
      return [parts[0], parts[1], parts[2]];
    }
  }
  return null;
}

/**
 * The brand CSS variables injected onto <html> in the root layout. They set the
 * palette (with readable foregrounds) and point the display/body font tokens at
 * the active profile's typefaces. Inline priority means they win over the
 * stylesheet in both light and dark themes.
 */
export function brandCssVars(): CSSProperties {
  return {
    "--brand": BRAND.primary,
    "--brand-foreground": readableText(BRAND.primary),
    "--accent": BRAND.accent,
    "--accent-foreground": readableText(BRAND.accent),
    "--brand-font-display": FONT_STACK[BRAND.fonts.display],
    "--brand-font-body": FONT_STACK[BRAND.fonts.body],
  } as CSSProperties;
}
