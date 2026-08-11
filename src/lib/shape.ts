/**
 * Shape helpers: turning amounts into the numbers a layout needs — totals,
 * shares, and bar widths. Money stays in INTEGER CENTS here as everywhere else;
 * only `formatPct` produces a display string.
 */

/** Sum of every `amountCents` in the list. 0 on an empty list. */
export function sumAmountCents<T extends { amountCents: number }>(items: T[]): number {
  let total = 0;
  for (const item of items) total += item.amountCents;
  return total;
}

/** `part` as a fraction of `total`, clamped at 0 when there is no total. */
export function share(part: number, total: number): number {
  return total === 0 ? 0 : part / total;
}

const percentFormatters = new Map<string, Intl.NumberFormat>();

function percentFormatter(locale: string): Intl.NumberFormat {
  let formatter = percentFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    percentFormatters.set(locale, formatter);
  }
  return formatter;
}

/**
 * A ratio as a rounded percentage, e.g. 0.3606 -> "36 %".
 *
 * A non-zero share below 1% renders "< 1 %" rather than "0 %": a line that costs
 * real money must not be labelled zero, and "0 %" on Netflix tells you nothing
 * you did not already know from its amount.
 */
export function formatPct(ratio: number, locale = "fr-FR"): string {
  if (ratio > 0 && ratio < 0.005) return `< ${percentFormatter(locale).format(0.01)}`;
  return percentFormatter(locale).format(ratio);
}

export interface StackWidths {
  /** One percentage per input, summing to 100 when the segments fill the total. */
  pct: number[];
  /** True when the segments add up to MORE than the total they are drawn against. */
  over: boolean;
}

/**
 * Segment widths for a stacked bar, as percentages of `totalCents`.
 *
 * Two decisions worth keeping:
 *
 * - When the segments exceed the total, the bar rescales to their sum and reports
 *   `over`, so the caller can state the overshoot. Clamping instead would hide it:
 *   an "Autres" poste at 1 646 € of a 900 € budget would draw exactly like one at
 *   900 €, which is how the existing `.bar` manages to make overspending invisible.
 * - Percentages are rounded by LARGEST REMAINDER, so they always add up to the
 *   scale and the bar closes exactly. Rounding each one independently leaves a
 *   sliver of track showing at the end of a bar that should be full.
 */
export function stackWidths(cents: number[], totalCents: number): StackWidths {
  const sum = cents.reduce((s, c) => s + c, 0);
  const scale = Math.max(totalCents, sum);
  if (scale <= 0) return { pct: cents.map(() => 0), over: false };

  const exact = cents.map((c) => (c / scale) * 100);
  const floors = exact.map(Math.floor);
  // How many whole points the flooring gave away; hand them to the segments with
  // the largest fractional parts.
  const target = sum >= scale ? 100 : Math.floor((sum / scale) * 100);
  let remaining = target - floors.reduce((s, f) => s + f, 0);

  const order = exact
    .map((value, i) => ({ i, frac: value - Math.floor(value) }))
    .toSorted((a, b) => b.frac - a.frac);

  const pct = [...floors];
  for (const { i } of order) {
    if (remaining <= 0) break;
    pct[i] += 1;
    remaining -= 1;
  }

  return { pct, over: sum > totalCents };
}
