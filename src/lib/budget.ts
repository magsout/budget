import { type MonthKey, monthOf, monthRange } from "./dates.ts";
import type { BudgetVersion, CarryOverride, Category, Dataset, Expense, User } from "./types.ts";

/** State of one category for one month. */
export interface MonthState {
  month: MonthKey;
  /** Initial monthly budget in effect for this category this month. */
  initialCents: number;
  /** Carried-over balance from the previous month (may be negative). */
  carryInCents: number;
  /** True when `carryInCents` was forced by hand rather than folded from M-1. */
  carryAdjusted: boolean;
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

/**
 * The hand-set carry-in for a category in a month, or null when none applies
 * (the normal case: the carry-in is folded from the previous month).
 */
export function carryOverrideFor(
  overrides: CarryOverride[],
  categoryId: string,
  month: MonthKey,
): number | null {
  const found = overrides.find((o) => o.categoryId === categoryId && o.month === month);
  return found ? found.carryInCents : null;
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
 * earliest budget version, its earliest carry override, and its earliest
 * (possibly back-dated) expense.
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
  for (const o of dataset.carryOverrides) {
    if (o.categoryId === categoryId) consider(o.month);
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
 *
 * A carry override replaces the folded carry-in for its month only; the fold
 * then resumes from the resulting remaining, so a reset in month M leaves the
 * months before M untouched and lets M+1 carry over as usual.
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
    const override = carryOverrideFor(dataset.carryOverrides, categoryId, month);
    const carryInCents = override ?? carry;
    const initialCents = budgetVersionFor(dataset.budgetVersions, categoryId, month);
    const spentCents = spentForCategoryMonth(dataset.expenses, categoryId, month);
    const startingCents = initialCents + carryInCents;
    const remainingCents = startingCents - spentCents;
    rows.push({
      month,
      initialCents,
      carryInCents,
      carryAdjusted: override !== null,
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
    carryAdjusted: false,
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

/**
 * How much of a poste's available budget is spent, as 0..100 for a bar width.
 *
 * Clamped at 100, so overspending is NOT conveyed by this number — the bar cannot
 * grow past full. That is what `remainingTone` (and the figure itself going red)
 * is for; a caller that needs to show the overshoot must say so in words.
 *
 * With nothing available, "spent" is all-or-nothing rather than a division by
 * zero: any spending on a poste with no budget is 100% of it.
 */
export function spentPercent(state: MonthState): number {
  if (state.startingCents > 0) {
    return Math.min(100, Math.max(0, (state.spentCents / state.startingCents) * 100));
  }
  return state.spentCents > 0 ? 100 : 0;
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

/**
 * Soft-deleted expenses, most recently deleted first — the Corbeille. Deletion
 * only sets `deletedAt`, so nothing is ever really lost; this is the list that
 * makes those rows reachable again. Ordered by deletion time, not by expense
 * date: what you want back is what you just removed by mistake.
 */
export function deletedExpenses(dataset: Dataset, limit = 20): Expense[] {
  return dataset.expenses
    .filter((e) => e.deletedAt)
    .toSorted((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""))
    .slice(0, limit);
}

/** A category holding expenses, and how many lines it holds. */
export interface CategoryExpenseCount {
  category: Category;
  count: number;
}

/**
 * How many of `expenses` fall in each category, keeping only the categories
 * that actually have some, in the dashboard's display order. Counts whatever
 * list it is handed (pass `expensesForMonth` output to scope it to a month),
 * and includes archived categories — an expense logged before archiving still
 * belongs to the month's list.
 */
export function categoryExpenseCounts(
  expenses: Expense[],
  categories: Category[],
): CategoryExpenseCount[] {
  const counts = new Map<string, number>();
  for (const e of expenses) counts.set(e.categoryId, (counts.get(e.categoryId) ?? 0) + 1);
  return categories
    .filter((c) => counts.has(c.id))
    .map((category) => ({ category, count: counts.get(category.id) ?? 0 }))
    .toSorted(
      (a, b) =>
        a.category.sortOrder - b.category.sortOrder ||
        a.category.name.localeCompare(b.category.name),
    );
}

/**
 * Rows of `expenses` belonging to `categoryId`. Everything is returned when the
 * id is null OR no longer matches any row — so a poste that loses its last
 * expense can never leave an empty list behind a filter that no longer exists.
 */
export function filterExpensesByCategory(
  expenses: Expense[],
  categoryId: string | null,
): Expense[] {
  if (categoryId === null) return expenses;
  const matching = expenses.filter((e) => e.categoryId === categoryId);
  return matching.length > 0 ? matching : expenses;
}

/** How much each person spent across `expenses`, biggest spender first. */
export interface UserSpend {
  user: User;
  totalCents: number;
  count: number;
}

/**
 * Per-person totals. Expenses have always carried `userId` without anything
 * aggregating it, though the app is built for a household. People with nothing
 * to their name this month are dropped rather than shown at zero.
 */
export function spendByUser(expenses: Expense[], users: User[]): UserSpend[] {
  const totals = new Map<string, { totalCents: number; count: number }>();
  for (const e of expenses) {
    const acc = totals.get(e.userId) ?? { totalCents: 0, count: 0 };
    totals.set(e.userId, { totalCents: acc.totalCents + e.amountCents, count: acc.count + 1 });
  }
  return users
    .filter((u) => totals.has(u.id))
    .map((user) => ({ user, ...(totals.get(user.id) ?? { totalCents: 0, count: 0 }) }))
    .toSorted(
      (a, b) => b.totalCents - a.totalCents || a.user.firstName.localeCompare(b.user.firstName),
    );
}

/**
 * The last `count` months of a category's timeline, oldest first. The fold
 * already produces the whole series; only one month of it was ever displayed.
 */
export function recentTimeline(
  dataset: Dataset,
  categoryId: string,
  uptoMonth: MonthKey,
  count: number,
): MonthState[] {
  return computeTimeline(dataset, categoryId, uptoMonth).slice(-count);
}

/** A frequently repeated expense, offered as a one-tap prefill. */
export interface FrequentExpense {
  categoryId: string;
  description: string | null;
  amountCents: number;
  count: number;
}

/**
 * The combinations (poste + description + amount) that keep coming back,
 * derived from the ledger rather than stored as templates: there is no extra
 * CRUD to maintain, and the list keeps itself current as habits change.
 *
 * Only combinations seen more than once qualify — a one-off is not a habit.
 * `since` bounds how far back to look (a month key, inclusive).
 */
export function frequentExpenses(
  expenses: Expense[],
  { since, limit = 4 }: { since: MonthKey; limit?: number },
): FrequentExpense[] {
  const seen = new Map<string, FrequentExpense>();
  for (const e of expenses) {
    if (e.deletedAt) continue;
    if (monthOf(e.date) < since) continue;
    const key = `${e.categoryId}|${e.description ?? ""}|${e.amountCents}`;
    const found = seen.get(key);
    if (found) {
      found.count += 1;
    } else {
      seen.set(key, {
        categoryId: e.categoryId,
        description: e.description,
        amountCents: e.amountCents,
        count: 1,
      });
    }
  }
  return [...seen.values()]
    .filter((f) => f.count > 1)
    .toSorted((a, b) => b.count - a.count || b.amountCents - a.amountCents)
    .slice(0, limit);
}

/** The earliest month with any activity across the whole dataset. */
export function earliestMonth(dataset: Dataset, fallback: MonthKey): MonthKey {
  let earliest: MonthKey | null = null;
  const consider = (m: MonthKey) => {
    if (earliest === null || m < earliest) earliest = m;
  };
  for (const c of dataset.categories) consider(monthKeyOfIso(c.createdAt));
  for (const v of dataset.budgetVersions) consider(v.effectiveFrom);
  for (const o of dataset.carryOverrides) consider(o.month);
  for (const e of dataset.expenses) if (!e.deletedAt) consider(monthOf(e.date));
  return earliest ?? fallback;
}

/** All month keys from the earliest activity up to and including `uptoMonth`. */
export function availableMonths(dataset: Dataset, uptoMonth: MonthKey): MonthKey[] {
  return monthRange(earliestMonth(dataset, uptoMonth), uptoMonth);
}
