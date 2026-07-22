/**
 * Per-product size guide, stored as JSON on `Product.sizeChart`.
 *
 * Shape: a small table of `{ columns, rows }` (all strings, so "24.5" or
 * "38-40" are fine). Admins type it as plain text — one row per line, cells
 * separated by commas (or tabs, so you can paste from a spreadsheet). The first
 * line is the column headings.
 */
export type SizeChart = { columns: string[]; rows: string[][] };

const MAX_COLS = 10;
const MAX_ROWS = 40;
const MAX_CELL = 40;

function cells(line: string): string[] {
  return line
    .split(/\t|,/)
    .map((c) => c.trim().slice(0, MAX_CELL))
    .slice(0, MAX_COLS);
}

/** Parse the admin textarea into a chart, or null if there isn't a usable one. */
export function parseSizeChartText(raw: string | null | undefined): SizeChart | null {
  if (!raw) return null;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null; // need a header row + at least one size

  const columns = cells(lines[0]).filter(Boolean);
  if (columns.length === 0) return null;

  const rows = lines
    .slice(1, 1 + MAX_ROWS)
    .map((line) => {
      const c = cells(line);
      // Normalise every row to the header width.
      return Array.from({ length: columns.length }, (_, i) => c[i] ?? "");
    })
    .filter((r) => r.some(Boolean)); // drop blank rows

  return rows.length > 0 ? { columns, rows } : null;
}

/** Turn a stored chart back into editable text for the admin textarea. */
export function sizeChartToText(chart: SizeChart | null): string {
  if (!chart) return "";
  return [chart.columns, ...chart.rows].map((r) => r.join(", ")).join("\n");
}

/** Validate/normalise an unknown JSON value from the DB into a safe chart. */
export function coerceSizeChart(value: unknown): SizeChart | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(v.columns) || !Array.isArray(v.rows)) return null;

  const columns = v.columns.map((c) => String(c ?? "")).filter(Boolean).slice(0, MAX_COLS);
  if (columns.length === 0) return null;

  const rows = v.rows
    .filter(Array.isArray)
    .slice(0, MAX_ROWS)
    .map((r) => Array.from({ length: columns.length }, (_, i) => String((r as unknown[])[i] ?? "")));
  if (rows.length === 0) return null;

  return { columns, rows };
}
