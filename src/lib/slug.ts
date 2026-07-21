/**
 * Lowercase, hyphenated, ASCII-safe slug — mirrors the legacy `slugify()`.
 *
 * Lives outside the `"use server"` action modules because every export from
 * one of those must be an async server function.
 */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    // Strip combining diacritical marks left behind by the decomposition.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "n-a";
}
