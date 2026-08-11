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

/**
 * Formatters are cached per locale AND per option set: `toLocaleDateString`
 * builds a fresh `Intl.DateTimeFormat` on every call, which dwarfs the
 * formatting itself — and these run once per row, and once per expense while
 * searching.
 *
 * The key must cover EVERY option that distinguishes two formatters. It used to
 * be just `${locale}|${options.month}`, which happened to work only because the
 * two callers differed on `month` ("long" vs "short"). Any third format reusing
 * a `month` value already in the cache would have silently received the wrong
 * formatter — `formatDayShort` asks for `{ weekday, day, month: "long" }` and
 * would have been handed `formatMonth`'s, printing "août 2026" for every day
 * header. Add an option here whenever a new format needs one.
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = [
    locale,
    options.weekday ?? "-",
    options.day ?? "-",
    options.month ?? "-",
    options.year ?? "-",
  ].join("|");
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/** Uppercase the first letter, the way French month and weekday labels want it. */
function capitalize(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Human label for a month key, e.g. "2026-07" -> "Juillet 2026". */
export function formatMonth(month: MonthKey, locale = "fr-FR"): string {
  const [y, m] = month.split("-").map(Number);
  return capitalize(
    dateFormatter(locale, { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1)),
  );
}

/** Human label for a date key, e.g. "2026-07-22" -> "22 juil. 2026". */
export function formatDate(date: DateKey, locale = "fr-FR"): string {
  const [y, m, d] = date.split("-").map(Number);
  return dateFormatter(locale, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(y, m - 1, d),
  );
}

/**
 * Day label for a group header, e.g. "2026-08-11" -> "Mar. 11 août". The year is
 * deliberately absent: the list is already scoped to one month, so repeating
 * "2026" on every header is noise.
 */
export function formatDayShort(date: DateKey, locale = "fr-FR"): string {
  const [y, m, d] = date.split("-").map(Number);
  return capitalize(
    dateFormatter(locale, { weekday: "short", day: "numeric", month: "long" }).format(
      new Date(y, m - 1, d),
    ),
  );
}

/** True when the date key is today, in the browser's local timezone. */
export function isToday(date: DateKey, now: Date = new Date()): boolean {
  return date === localToday(now);
}
