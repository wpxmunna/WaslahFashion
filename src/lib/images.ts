/**
 * Image paths come from two eras: legacy rows store an upload-relative path
 * like `products/abc.jpg`, while seeded/remote rows store an absolute URL.
 */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `/uploads/${path.replace(/^\/+/, "")}`;
}

/** Deterministic neutral tone for products with no photograph yet. */
export function placeholderTone(seed: string): string {
  // Cool neutrals with a faint green cast, so empty tiles sit with the brand.
  const tones = ["#EDF0EE", "#E7EBE9", "#F0F2F0", "#E9EEEC"];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return tones[hash % tones.length];
}
