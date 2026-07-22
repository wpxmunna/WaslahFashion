/**
 * Every font a brand profile can select (see FONT_STACK in src/lib/brand.ts).
 *
 * next/font requires static, module-scope calls, so all selectable fonts are
 * registered here and their CSS variables applied to <html> in the root layout.
 * Only the two referenced by the active profile are wired to `--brand-font-*`
 * (in brandCssVars), so only those get rendered — the browser downloads a font
 * file only when it's actually applied to text, and `preload: false` keeps the
 * unused ones from being fetched eagerly.
 *
 * To add a typeface: import it here with a `--font-x` variable, add the same
 * key → `var(--font-x)` entry to FONT_STACK, then reference it from a profile.
 */
import {
  Bricolage_Grotesque,
  Fraunces,
  Instrument_Sans,
  Manrope,
  Playfair_Display,
  Syne,
} from "next/font/google";

// next/font statically analyses each call, so the options must be written as
// literal objects here — no shared/spread config.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/** Space-joined className that registers every font variable on the element. */
export const FONT_CLASS = [
  bricolage.variable,
  instrument.variable,
  fraunces.variable,
  syne.variable,
  manrope.variable,
  playfair.variable,
].join(" ");
