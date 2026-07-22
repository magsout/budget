import type { DateKey, MonthKey } from "./dates.ts";

/** A person who can be attributed to an expense. Just a label, not an auth account. */
export interface User {
  id: string;
  firstName: string;
  createdAt: string; // ISO timestamp
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

/** The full app dataset loaded into memory (tiny at household scale). */
export interface Dataset {
  users: User[];
  categories: Category[];
  budgetVersions: BudgetVersion[];
  expenses: Expense[];
}
