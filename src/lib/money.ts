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

/** Format integer cents as a localized euro string, e.g. -35012 -> "-350,12 €". */
export function formatCents(cents: number, locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Format integer cents as a plain decimal string for form inputs, e.g. 65000 -> "650,00". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** True when the string parses to a strictly positive amount of cents. */
export function isValidPositiveAmount(input: string): boolean {
  const cents = eurosToCents(input);
  return Number.isFinite(cents) && cents > 0;
}
