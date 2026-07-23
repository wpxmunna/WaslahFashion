/**
 * Ordering for product variants so sizes read in the natural sequence
 * (XS < S < M < L < XL < XXL …) instead of alphabetically (L < M < XL).
 *
 * MySQL can't express this ordering cheaply, so variants are sorted in
 * application code at the points that display them.
 */
const RANK: Record<string, number> = {};
["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"].forEach((s, i) => {
  RANK[s] = i;
});
// Common numeric-style aliases.
RANK["2XL"] = RANK["XXL"];
RANK["3XL"] = RANK["XXXL"];
RANK["4XL"] = RANK["XXXXL"];

/** Rank a size label for display ordering. Lower sorts first. */
export function sizeRank(size: string | null | undefined): number {
  if (!size) return 1000; // sizeless variants go last
  const s = size.trim().toUpperCase().replace(/\s+/g, "");
  if (s in RANK) return RANK[s];
  const n = parseFloat(s);
  if (!Number.isNaN(n)) return 100 + n; // numeric sizes (28, 30, 32 …) in numeric order
  return 900; // unknown labels near the end, then alphabetical
}

type VariantOrder = { size: string | null; colorName?: string | null };

/** Comparator: by size sequence, then colour name. */
export function compareVariants(a: VariantOrder, b: VariantOrder): number {
  const ra = sizeRank(a.size);
  const rb = sizeRank(b.size);
  if (ra !== rb) return ra - rb;
  const sa = a.size ?? "";
  const sb = b.size ?? "";
  if (sa !== sb) return sa.localeCompare(sb);
  return (a.colorName ?? "").localeCompare(b.colorName ?? "");
}
