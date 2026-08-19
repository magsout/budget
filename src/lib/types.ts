import type { DateKey, MonthKey } from "./dates.ts";

/** A person who can be attributed to an expense. Just a label, not an auth account. */
export interface User {
  id: string;
  firstName: string;
  createdAt: string; // ISO timestamp
  /**
   * Set when the person is retired from the pickers. OPTIONAL on purpose: docs
   * created before this field exists have no value, and `undefined` reads as
   * active — so no migration is needed. Never hard-delete a user: expenses
   * reference `userId` and would lose their author.
   */
  archivedAt?: string | null;
}

/** An expense category ("poste de dépenses"). */
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  color?: string;
  createdAt: string; // ISO timestamp
  /** Set when the category is soft-archived; it stops contributing budget from then on. */
  archivedAt: string | null;
}

/**
 * Versioned monthly initial amount for a category (Slowly-Changing-Dimension type 2).
 * The initial amount for category C in month M = the version with the greatest
 * `effectiveFrom` that is <= M. Changing an amount adds a new version instead of
 * rewriting history, so past months keep the amount that was in effect then.
 */
export interface BudgetVersion {
  id: string;
  categoryId: string;
  amountCents: number;
  effectiveFrom: MonthKey; // "YYYY-MM"
}

/**
 * A manual override of a category's carried-over balance for one month.
 * Without one, the carry-in is the previous month's remaining (see lib/budget.ts).
 * With one, the fold uses `carryInCents` for that month instead — `0` means
 * "repartir de zéro", i.e. ignore last month's leftover (or overdraft). Later
 * months keep folding normally from there.
 */
export interface CarryOverride {
  id: string;
  categoryId: string;
  month: MonthKey; // "YYYY-MM" — the month whose carry-in is forced
  carryInCents: number; // may be negative; 0 = reset
  createdAt: string; // ISO timestamp
}

/** A single expense — the immutable ledger and the source of truth for balances. */
export interface Expense {
  id: string;
  categoryId: string;
  userId: string;
  amountCents: number;
  description: string | null;
  date: DateKey; // "YYYY-MM-DD", local
  createdAt: string; // ISO timestamp
  deletedAt: string | null; // soft delete
}

/**
 * A recurring monthly expense shown in the Compte (cashflow) tab — a template,
 * not a ledger entry. It contributes its full amount to every month within its
 * [startMonth, endMonth] window (both inclusive; null = open-ended). Stopping a
 * charge going forward = set endMonth; deletedAt only hides a mistaken entry.
 */
export interface RecurringExpense {
  id: string;
  name: string;
  amountCents: number;
  description: string | null;
  startMonth: MonthKey | null; // "YYYY-MM" inclusive; null = no lower bound
  endMonth: MonthKey | null; // "YYYY-MM" inclusive; null = no upper bound
  createdAt: string; // ISO timestamp
  deletedAt: string | null; // soft delete
}

/** A recurring monthly income (revenu). Same shape/semantics as RecurringExpense. */
export interface Income {
  id: string;
  name: string;
  amountCents: number;
  description: string | null;
  startMonth: MonthKey | null;
  endMonth: MonthKey | null;
  createdAt: string;
  deletedAt: string | null;
}

/**
 * A movement of money between the postes of one month. Balanced by construction:
 * the amount is always positive and the direction lives in `fromCategoryId` /
 * `toCategoryId`, so a transfer cannot unbalance the books nor half-disappear —
 * one doc is the whole movement, and deleting it undoes both sides at once.
 *
 * `fromCategoryId === null` means the money came from OUTSIDE the postes (an
 * apport); that is the only nullable field the fold reads. `fromIncomeId` is
 * attribution only — which one-off income funded the apport, so the Compte tab
 * can show that money as consumed rather than still available.
 *
 * Two needs, one shape: redirecting a report from an important poste onto a less
 * important one is the same gesture as topping a poste up from a bonus, the
 * source apart.
 */
export interface BudgetMovement {
  id: string;
  month: MonthKey; // "YYYY-MM" — the month whose balances it shifts
  /** Poste the money leaves; null = it comes from outside (an apport). */
  fromCategoryId: string | null;
  /** Poste the money lands in. */
  toCategoryId: string;
  /** One-off income funding an apport. Attribution only, never load-bearing. */
  fromIncomeId: string | null;
  amountCents: number; // always > 0 — the direction is in from/to, not the sign
  label: string | null;
  createdAt: string; // ISO timestamp
  deletedAt: string | null; // soft delete
}

/** The full app dataset loaded into memory (tiny at household scale). */
export interface Dataset {
  users: User[];
  categories: Category[];
  budgetVersions: BudgetVersion[];
  carryOverrides: CarryOverride[];
  budgetMovements: BudgetMovement[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  incomes: Income[];
}
