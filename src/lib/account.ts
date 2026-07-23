import { budgetVersionFor, categoriesActiveIn } from "./budget.ts";
import type { MonthKey } from "./dates.ts";
import type { Category, Dataset, Income, RecurringExpense } from "./types.ts";

/**
 * Cashflow computations for the Compte tab. Income and recurring-expense values
 * are derived from the [startMonth, endMonth] window on each render — no ledger,
 * no carryover. The tab also surfaces the category budgets (lib/budget.ts) as a
 * planned deduction: each active poste contributes its allocated monthly budget
 * (the versioned initial amount for the month), never its actuals or carryover.
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

/** A category and the monthly budget it contributes to the cashflow this month. */
export interface CategoryBudgetLine {
  category: Category;
  amountCents: number;
}

/**
 * Active categories in `month` with their allocated monthly budget, largest
 * first (name as tiebreak). Categories with a zero budget for the month are
 * dropped — they would only add noise to the Compte tab. `categoriesActiveIn`
 * and `budgetVersionFor` already resolve the month (archived/future postes
 * excluded, correct versioned amount), so this follows the month stepper.
 */
export function categoryBudgetsActiveIn(dataset: Dataset, month: MonthKey): CategoryBudgetLine[] {
  return categoriesActiveIn(dataset, month)
    .map((category) => ({
      category,
      amountCents: budgetVersionFor(dataset.budgetVersions, category.id, month),
    }))
    .filter((l) => l.amountCents > 0)
    .toSorted(
      (a, b) => b.amountCents - a.amountCents || a.category.name.localeCompare(b.category.name),
    );
}

export interface AccountSummary {
  incomeCents: number;
  expenseCents: number;
  /** income − expense; may be negative. */
  remainingCents: number;
  /** Sum of every active category's allocated monthly budget for the month. */
  budgetCents: number;
  /** income − expense − budget; the true disposable after budgets. */
  remainingAfterBudgetsCents: number;
}

/** Cashflow totals for a month. */
export function accountSummary(dataset: Dataset, month: MonthKey): AccountSummary {
  const incomeCents = incomesActiveIn(dataset, month).reduce((s, i) => s + i.amountCents, 0);
  const expenseCents = recurringExpensesActiveIn(dataset, month).reduce(
    (s, e) => s + e.amountCents,
    0,
  );
  const budgetCents = categoryBudgetsActiveIn(dataset, month).reduce(
    (s, l) => s + l.amountCents,
    0,
  );
  const remainingCents = incomeCents - expenseCents;
  return {
    incomeCents,
    expenseCents,
    remainingCents,
    budgetCents,
    remainingAfterBudgetsCents: remainingCents - budgetCents,
  };
}
