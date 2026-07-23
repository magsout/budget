import type { MonthKey } from "./dates.ts";
import type { Dataset, Income, RecurringExpense } from "./types.ts";

/**
 * Cashflow computations for the Compte tab. Deliberately independent of the
 * category/budget system (lib/budget.ts): reads only `recurringExpenses` and
 * `incomes`. Every value is derived from the [startMonth, endMonth] window on
 * each render — no ledger, no carryover.
 */

/**
 * Active in month M iff (startMonth == null || startMonth <= M)
 * && (endMonth == null || M <= endMonth). Both bounds INCLUSIVE; null = open.
 * Month strings ("YYYY-MM") compare lexicographically.
 */
export function activeInMonth(
  item: { startMonth: MonthKey | null; endMonth: MonthKey | null },
  month: MonthKey,
): boolean {
  if (item.startMonth && item.startMonth > month) return false;
  if (item.endMonth && item.endMonth < month) return false;
  return true;
}

/** Largest amount first, name as a stable tiebreak. */
function byAmountDesc(
  a: { amountCents: number; name: string },
  b: { amountCents: number; name: string },
): number {
  return b.amountCents - a.amountCents || a.name.localeCompare(b.name);
}

/** Non-deleted recurring expenses active in `month`, largest first. */
export function recurringExpensesActiveIn(dataset: Dataset, month: MonthKey): RecurringExpense[] {
  return dataset.recurringExpenses
    .filter((e) => !e.deletedAt && activeInMonth(e, month))
    .toSorted(byAmountDesc);
}

/** Non-deleted incomes active in `month`, largest first. */
export function incomesActiveIn(dataset: Dataset, month: MonthKey): Income[] {
  return dataset.incomes
    .filter((i) => !i.deletedAt && activeInMonth(i, month))
    .toSorted(byAmountDesc);
}

export interface AccountSummary {
  incomeCents: number;
  expenseCents: number;
  /** income − expense; may be negative. */
  remainingCents: number;
}

/** Cashflow totals for a month. */
export function accountSummary(dataset: Dataset, month: MonthKey): AccountSummary {
  const incomeCents = incomesActiveIn(dataset, month).reduce((s, i) => s + i.amountCents, 0);
  const expenseCents = recurringExpensesActiveIn(dataset, month).reduce(
    (s, e) => s + e.amountCents,
    0,
  );
  return { incomeCents, expenseCents, remainingCents: incomeCents - expenseCents };
}
