/**
 * Month/date helpers. All month boundaries are computed in the browser's LOCAL
 * timezone, and expense dates are stored as bare "YYYY-MM-DD" strings, so an
 * expense logged near midnight on the 1st never leaks into the wrong month.
 */

/** A month key in the form "YYYY-MM". */
export type MonthKey = string;

/** A local calendar date in the form "YYYY-MM-DD". */
export type DateKey = string;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Today as a local "YYYY-MM-DD" string (never UTC). */
export function localToday(now: Date = new Date()): DateKey {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** The current local month as "YYYY-MM". */
export function currentMonth(now: Date = new Date()): MonthKey {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

/** Extract the month key ("YYYY-MM") from a "YYYY-MM-DD" date string. */
export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7);
}

/** The month immediately after the given month key. */
export function nextMonth(month: MonthKey): MonthKey {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`;
}

/** The month immediately before the given month key. */
export function prevMonth(month: MonthKey): MonthKey {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad2(m - 1)}`;
}

/**
 * Inclusive, contiguous list of month keys from `from` to `to`.
 * Returns [] if `from` is after `to`.
 */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  if (from > to) return [];
  const out: MonthKey[] = [];
  let cursor = from;
  // Guard against pathological ranges (e.g. corrupt data) — 100 years max.
  for (let i = 0; i < 1200 && cursor <= to; i++) {
    out.push(cursor);
    if (cursor === to) break;
    cursor = nextMonth(cursor);
  }
  return out;
}

/** Human label for a month key, e.g. "2026-07" -> "juillet 2026". */
export function formatMonth(month: MonthKey, locale = "fr-FR"): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Human label for a date key, e.g. "2026-07-22" -> "22 juil. 2026". */
export function formatDate(date: DateKey, locale = "fr-FR"): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
