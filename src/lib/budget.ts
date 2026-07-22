import { type MonthKey, monthOf, monthRange } from "./dates.ts";
import type { BudgetVersion, Category, Dataset, Expense } from "./types.ts";

/** State of one category for one month. */
export interface MonthState {
  month: MonthKey;
  /** Initial monthly budget in effect for this category this month. */
  initialCents: number;
  /** Carried-over balance from the previous month (may be negative). */
  carryInCents: number;
  /** initial + carryIn — the budget actually available this month. */
  startingCents: number;
  /** Total spent in this category this month. */
  spentCents: number;
  /** starting - spent — becomes next month's carryIn (may be negative). */
  remainingCents: number;
}

export interface CategorySummary {
  category: Category;
  state: MonthState;
}

function monthKeyOfIso(iso: string): MonthKey {
  return iso.slice(0, 7);
}

/**
 * Initial amount for a category in a given month = the versioned amount whose
 * `effectiveFrom` is the greatest value <= month. Returns 0 when no version
 * applies yet (e.g. a back-dated expense before the category's first budget).
 */
export function budgetVersionFor(
  versions: BudgetVersion[],
  categoryId: string,
  month: MonthKey,
): number {
  let best: BudgetVersion | null = null;
  for (const v of versions) {
    if (v.categoryId !== categoryId) continue;
    if (v.effectiveFrom > month) continue;
    if (best === null || v.effectiveFrom > best.effectiveFrom) best = v;
  }
  return best ? best.amountCents : 0;
}

/** Sum of non-deleted expenses for a category in a given month. */
export function spentForCategoryMonth(
  expenses: Expense[],
  categoryId: string,
  month: MonthKey,
): number {
  let total = 0;
  for (const e of expenses) {
    if (e.deletedAt) continue;
    if (e.categoryId !== categoryId) continue;
    if (monthOf(e.date) !== month) continue;
    total += e.amountCents;
  }
  return total;
}

/**
 * Earliest month relevant to a category: the min of its creation month, its
 * earliest budget version, and its earliest (possibly back-dated) expense.
 */
export function firstActivityMonth(
  dataset: Dataset,
  categoryId: string,
  fallback: MonthKey,
): MonthKey {
  const category = dataset.categories.find((c) => c.id === categoryId);
  let earliest: MonthKey | null = category ? monthKeyOfIso(category.createdAt) : null;

  const consider = (m: MonthKey) => {
    if (earliest === null || m < earliest) earliest = m;
  };

  for (const v of dataset.budgetVersions) {
    if (v.categoryId === categoryId) consider(v.effectiveFrom);
  }
  for (const e of dataset.expenses) {
    if (e.categoryId === categoryId && !e.deletedAt) consider(monthOf(e.date));
  }

  return earliest ?? fallback;
}

/**
 * Recompute a category's full month timeline from the raw ledger, folding the
 * carryover forward. This is the single source of truth for every balance:
 * skipped months, back-dated expenses and versioned budget changes all resolve
 * correctly because nothing is ever frozen.
 */
export function computeTimeline(
  dataset: Dataset,
  categoryId: string,
  uptoMonth: MonthKey,
): MonthState[] {
  const start = firstActivityMonth(dataset, categoryId, uptoMonth);
  const months = monthRange(start, uptoMonth);
  const rows: MonthState[] = [];
  let carry = 0;
  for (const month of months) {
    const initialCents = budgetVersionFor(dataset.budgetVersions, categoryId, month);
    const spentCents = spentForCategoryMonth(dataset.expenses, categoryId, month);
    const startingCents = initialCents + carry;
    const remainingCents = startingCents - spentCents;
    rows.push({
      month,
      initialCents,
      carryInCents: carry,
      startingCents,
      spentCents,
      remainingCents,
    });
    carry = remainingCents;
  }
  return rows;
}

/** State of a category for a single month (the last row of its timeline up to it). */
export function monthStateFor(
  dataset: Dataset,
  categoryId: string,
  month: MonthKey,
): MonthState | null {
  const timeline = computeTimeline(dataset, categoryId, month);
  return timeline.length > 0 ? timeline[timeline.length - 1] : null;
}

/**
 * Categories that exist and are not yet archived in the given month.
 * A category archived in month X remains visible through X-1 and disappears
 * from X onward; its leftover balance is forfeited (not redistributed).
 */
export function categoriesActiveIn(dataset: Dataset, month: MonthKey): Category[] {
  return dataset.categories.filter((c) => {
    const created = monthKeyOfIso(c.createdAt);
    if (created > month) return false;
    if (c.archivedAt && monthKeyOfIso(c.archivedAt) <= month) return false;
    return true;
  });
}

function emptyState(month: MonthKey): MonthState {
  return {
    month,
    initialCents: 0,
    carryInCents: 0,
    startingCents: 0,
    spentCents: 0,
    remainingCents: 0,
  };
}

/** Per-category state for every category active in `month`, sorted for display. */
export function monthSummary(dataset: Dataset, month: MonthKey): CategorySummary[] {
  return categoriesActiveIn(dataset, month)
    .toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((category) => ({
      category,
      state: monthStateFor(dataset, category.id, month) ?? emptyState(month),
    }));
}

/** Total remaining (sum of every active category's remaining) for a month. */
export function totalRemaining(dataset: Dataset, month: MonthKey): number {
  return monthSummary(dataset, month).reduce((sum, s) => sum + s.state.remainingCents, 0);
}

/** Non-deleted expenses for a month, most recent first. */
export function expensesForMonth(dataset: Dataset, month: MonthKey): Expense[] {
  return dataset.expenses
    .filter((e) => !e.deletedAt && monthOf(e.date) === month)
    .toSorted((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt),
    );
}

/** The earliest month with any activity across the whole dataset. */
export function earliestMonth(dataset: Dataset, fallback: MonthKey): MonthKey {
  let earliest: MonthKey | null = null;
  const consider = (m: MonthKey) => {
    if (earliest === null || m < earliest) earliest = m;
  };
  for (const c of dataset.categories) consider(monthKeyOfIso(c.createdAt));
  for (const v of dataset.budgetVersions) consider(v.effectiveFrom);
  for (const e of dataset.expenses) if (!e.deletedAt) consider(monthOf(e.date));
  return earliest ?? fallback;
}

/** All month keys from the earliest activity up to and including `uptoMonth`. */
export function availableMonths(dataset: Dataset, uptoMonth: MonthKey): MonthKey[] {
  return monthRange(earliestMonth(dataset, uptoMonth), uptoMonth);
}
