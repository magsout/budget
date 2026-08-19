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

/**
 * Hand out `target` whole units across `exact` reals so the parts sum to EXACTLY
 * `target`: each part is the floor of its real, then the units lost to flooring go
 * to the largest fractional parts.
 *
 * Shared because two callers guard the same money-conservation invariant with it —
 * a bar that must close exactly (`stackWidths`) and a pot that must be handed out
 * to the cent (`spreadOverShortfalls`). Rounding each part on its own leaves a
 * sliver of track showing, or a cent unspent.
 *
 * Only ever ADDS units, so it expects `target >= sum of the floors` — which holds
 * whenever `exact` is a split of `target`, the way both callers build it. Handed a
 * smaller target it returns the floors rather than trimming them.
 */
export function largestRemainder(exact: number[], target: number): number[] {
  const parts = exact.map(Math.floor);
  let remaining = target - parts.reduce((s, f) => s + f, 0);
  const order = exact
    .map((value, i) => ({ i, frac: value - Math.floor(value) }))
    .toSorted((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remaining <= 0) break;
    parts[i] += 1;
    remaining -= 1;
  }
  return parts;
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
  const target = sum >= scale ? 100 : Math.floor((sum / scale) * 100);
  return { pct: largestRemainder(exact, target), over: sum > totalCents };
}
