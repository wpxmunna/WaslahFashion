/**
 * Date helpers for the `@db.Date` and `@db.Time` columns.
 *
 * Prisma stores a `@db.Time` value on the 1970-01-01 UTC epoch day, so times
 * must be read and written with UTC accessors — using local accessors shifts
 * them by the host's offset.
 */

/** `2026-07-21` — the value an `<input type="date">` expects. */
export function dateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** `14:30` — the value an `<input type="time">` expects. */
export function timeInputValue(time: Date | null | undefined): string {
  if (!time) return "";
  const h = String(time.getUTCHours()).padStart(2, "0");
  const m = String(time.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Parse `HH:MM` into the epoch-day Date a `@db.Time` column expects. */
export function parseTimeInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
}

/** Parse `YYYY-MM-DD` into a UTC-midnight Date for a `@db.Date` column. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const d = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `21 Jul 2026` */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** `21 Jul 2026, 14:30` */
export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `14:30` from a `@db.Time` column. */
export function formatTime(time: Date | null | undefined): string {
  if (!time) return "—";
  return timeInputValue(time);
}

/** Hours between two `@db.Time` values, to 2dp. Negative spans return 0. */
export function hoursBetween(start: Date | null, end: Date | null): number {
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

/** Inclusive [start, end] for a month, as UTC-midnight bounds. */
export function monthBounds(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0)),
  };
}
