import { isSortValue, type SortValue } from "./config";

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export type ParsedShopParams = {
  page: number;
  sort: SortValue;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  /** Query string for pagination links, `page` excluded. */
  query: string;
};

export function parseShopParams(raw: RawSearchParams): ParsedShopParams {
  const pageRaw = Number(first(raw.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const sortRaw = first(raw.sort);
  const sort: SortValue = isSortValue(sortRaw) ? sortRaw : "newest";

  let minPrice = positiveNumber(first(raw.min_price));
  let maxPrice = positiveNumber(first(raw.max_price));

  // A reversed range would silently return nothing; swap instead.
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const search = first(raw.q)?.trim() || undefined;

  const query = new URLSearchParams();
  if (sort !== "newest") query.set("sort", sort);
  if (minPrice !== undefined) query.set("min_price", String(minPrice));
  if (maxPrice !== undefined) query.set("max_price", String(maxPrice));
  if (search) query.set("q", search);

  return { page, sort, minPrice, maxPrice, search, query: query.toString() };
}
