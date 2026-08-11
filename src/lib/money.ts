/**
 * Money is stored and computed as INTEGER CENTS to avoid floating-point drift
 * in the compounding carryover chain. Euros only ever appear at display time.
 */

/** Parse a user-typed euro amount ("12,50", "12.5", "  12 ") into integer cents. */
export function eurosToCents(input: string | number): number {
  if (typeof input === "number") {
    return Math.round(input * 100);
  }
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
}

/**
 * Formatters are cached per locale: building an `Intl.NumberFormat` costs far
 * more than the formatting itself, and these run once per row on every render.
 */
const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(locale: string): Intl.NumberFormat {
  let formatter = currencyFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
    currencyFormatters.set(locale, formatter);
  }
  return formatter;
}

/** Format integer cents as a localized euro string, e.g. -35012 -> "-350,12 €". */
export function formatCents(cents: number, locale = "fr-FR"): string {
  return currencyFormatter(locale).format(cents / 100);
}

/** Format integer cents as a plain decimal string for form inputs, e.g. 65000 -> "650,00". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const plainFormatters = new Map<string, Intl.NumberFormat>();

function plainFormatter(locale: string): Intl.NumberFormat {
  let formatter = plainFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    plainFormatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * Integer cents WITHOUT the currency symbol but WITH thousands grouping, e.g.
 * 454550 -> "4 545,50". For pairs like "161,60 / 4 545,50 €", where repeating the
 * € on both sides is noise but losing the group separator is not: `centsToInput`
 * renders that same figure "4545,50", which is measurably harder to read.
 */
export function formatCentsPlain(cents: number, locale = "fr-FR"): string {
  return plainFormatter(locale).format(cents / 100);
}

/** True when the string parses to a strictly positive amount of cents. */
export function isValidPositiveAmount(input: string): boolean {
  const cents = eurosToCents(input);
  return Number.isFinite(cents) && cents > 0;
}

/** True when the string parses to any amount of cents — zero and negative included. */
export function isValidAmount(input: string): boolean {
  return Number.isFinite(eurosToCents(input));
}
