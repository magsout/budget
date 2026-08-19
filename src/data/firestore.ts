import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase.ts";
import { currentMonth, type MonthKey } from "../lib/dates.ts";
import type { DateKey } from "../lib/dates.ts";

export const usersCol = collection(db, "users");
export const categoriesCol = collection(db, "categories");
export const budgetVersionsCol = collection(db, "budgetVersions");
export const carryOverridesCol = collection(db, "carryOverrides");
export const expensesCol = collection(db, "expenses");
export const recurringExpensesCol = collection(db, "recurringExpenses");
export const incomesCol = collection(db, "incomes");
export const budgetMovementsCol = collection(db, "budgetMovements");

function nowIso(): string {
  return new Date().toISOString();
}

/** Normalise an optional month input: blank/undefined → null (open-ended). */
function monthOrNull(m: MonthKey | null | undefined): MonthKey | null {
  return m && m.trim() ? m.trim() : null;
}

/* ---- users -------------------------------------------------------------- */

export async function addUser(firstName: string): Promise<void> {
  await addDoc(usersCol, { firstName: firstName.trim(), createdAt: nowIso(), archivedAt: null });
}

export async function updateUser(id: string, firstName: string): Promise<void> {
  await updateDoc(doc(usersCol, id), { firstName: firstName.trim() });
}

/**
 * Retire (or bring back) a person. Deliberately not a delete: expenses carry
 * `userId`, and removing the doc would leave them without an author.
 */
export async function setUserArchived(id: string, archived: boolean): Promise<void> {
  await updateDoc(doc(usersCol, id), { archivedAt: archived ? nowIso() : null });
}

/* ---- categories --------------------------------------------------------- */

export interface NewCategoryInput {
  name: string;
  amountCents: number;
  color?: string;
  sortOrder?: number;
  effectiveFrom?: MonthKey;
}

/** Create a category and its first (v1) budget version atomically. */
export async function addCategory(input: NewCategoryInput): Promise<void> {
  const batch = writeBatch(db);
  const catRef = doc(categoriesCol);
  batch.set(catRef, {
    name: input.name.trim(),
    sortOrder: input.sortOrder ?? Date.now(),
    color: input.color ?? null,
    createdAt: nowIso(),
    archivedAt: null,
  });
  const verRef = doc(budgetVersionsCol);
  batch.set(verRef, {
    categoryId: catRef.id,
    amountCents: input.amountCents,
    effectiveFrom: input.effectiveFrom ?? currentMonth(),
  });
  await batch.commit();
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string | null; sortOrder?: number },
): Promise<void> {
  await updateDoc(doc(categoriesCol, id), patch);
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  await updateDoc(doc(categoriesCol, id), { archivedAt: archived ? nowIso() : null });
}

/**
 * Persist a hand-picked order for the postes. Renumbers the whole list to
 * 0..n-1 in one batch rather than swapping two values: `sortOrder` starts life
 * as `Date.now()`, so renumbering also normalises those away for good.
 */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(categoriesCol, id), { sortOrder: index });
  });
  await batch.commit();
}

/**
 * Change a category's initial monthly amount from a given month onward. Adds a
 * new versioned amount, or overwrites the existing version for that same month
 * so the SCD-2 lookup stays unambiguous.
 */
export async function changeCategoryBudget(
  categoryId: string,
  amountCents: number,
  effectiveFrom: MonthKey = currentMonth(),
): Promise<void> {
  const existing = await getDocs(
    query(
      budgetVersionsCol,
      where("categoryId", "==", categoryId),
      where("effectiveFrom", "==", effectiveFrom),
    ),
  );
  if (!existing.empty) {
    await updateDoc(existing.docs[0].ref, { amountCents });
    return;
  }
  await addDoc(budgetVersionsCol, { categoryId, amountCents, effectiveFrom });
}

/* ---- carry overrides ---------------------------------------------------- */

/**
 * At most one override per (category, month), so the doc id is derived from the
 * pair rather than auto-generated: the write is idempotent, needs no
 * read-modify-write round trip, and therefore still works offline.
 */
function carryOverrideRef(categoryId: string, month: MonthKey) {
  return doc(carryOverridesCol, `${categoryId}_${month}`);
}

/**
 * Force a category's carried-over balance for `month`, replacing the amount
 * folded from the previous month. `0` means "repartir de zéro" — ignore last
 * month's leftover (or overdraft) without touching the past.
 */
export async function setCarryOverride(
  categoryId: string,
  month: MonthKey,
  carryInCents: number,
): Promise<void> {
  await setDoc(carryOverrideRef(categoryId, month), {
    categoryId,
    month,
    carryInCents,
    createdAt: nowIso(),
  });
}

/** Drop the override so the carry-in is computed from the ledger again. */
export async function clearCarryOverride(categoryId: string, month: MonthKey): Promise<void> {
  await deleteDoc(carryOverrideRef(categoryId, month));
}

/* ---- budget movements --------------------------------------------------- */

export interface NewMovementInput {
  month: MonthKey;
  /** null = an apport, i.e. money brought in from outside the postes. */
  fromCategoryId: string | null;
  toCategoryId: string;
  fromIncomeId?: string | null;
  amountCents: number;
  label?: string | null;
}

/** Apports come from outside; transfers move a report between two postes. */
export type MovementKind = "apport" | "transfer";

function kindOf(m: { fromCategoryId: string | null }): MovementKind {
  return m.fromCategoryId === null ? "apport" : "transfer";
}

/**
 * Replace a month's movements of one kind with `inputs`, in a SINGLE batch. Two
 * properties come from doing it this way:
 *
 * - The books never pass through an unbalanced state, offline included. A
 *   repartition lands whole or not at all, so no snapshot can ever show money
 *   that left one poste without arriving in another.
 * - Re-validating the screen is idempotent instead of duplicating: the previous
 *   set is retired in the same commit that writes the new one.
 *
 * The old set is soft-deleted rather than removed, like expenses — the gesture
 * that patched a hole stays as much a part of the record as the hole itself.
 * Ids are auto-generated (unlike carry overrides, which are one per
 * category+month): several movements can legitimately target the same poste in
 * the same month, so there is no natural key to derive an id from.
 */
export async function replaceBudgetMovements(
  month: MonthKey,
  kind: MovementKind,
  inputs: NewMovementInput[],
): Promise<void> {
  const existing = await getDocs(query(budgetMovementsCol, where("month", "==", month)));
  const batch = writeBatch(db);
  const now = nowIso();

  for (const d of existing.docs) {
    const row = d.data() as { fromCategoryId: string | null; deletedAt: string | null };
    if (row.deletedAt) continue;
    if (kindOf(row) !== kind) continue;
    batch.update(d.ref, { deletedAt: now });
  }

  for (const input of inputs) {
    if (input.amountCents <= 0) continue;
    if (input.fromCategoryId === input.toCategoryId) continue;
    batch.set(doc(budgetMovementsCol), {
      month: input.month,
      fromCategoryId: input.fromCategoryId,
      toCategoryId: input.toCategoryId,
      fromIncomeId: input.fromIncomeId ?? null,
      amountCents: input.amountCents,
      label: input.label?.trim() ? input.label.trim() : null,
      createdAt: now,
      deletedAt: null,
    });
  }

  await batch.commit();
}

/** Retire one movement. Both of its sides go at once — that is the point of one doc. */
export async function softDeleteBudgetMovement(id: string): Promise<void> {
  await updateDoc(doc(budgetMovementsCol, id), { deletedAt: nowIso() });
}

/* ---- expenses ----------------------------------------------------------- */

export interface NewExpenseInput {
  categoryId: string;
  userId: string;
  amountCents: number;
  description?: string | null;
  date: DateKey;
}

export async function addExpense(input: NewExpenseInput): Promise<void> {
  await addDoc(expensesCol, {
    categoryId: input.categoryId,
    userId: input.userId,
    amountCents: input.amountCents,
    description: input.description?.trim() ? input.description.trim() : null,
    date: input.date,
    createdAt: nowIso(),
    deletedAt: null,
  });
}

/** Update the editable fields of an expense (keeps createdAt / deletedAt). */
export async function updateExpense(id: string, input: NewExpenseInput): Promise<void> {
  await updateDoc(doc(expensesCol, id), {
    categoryId: input.categoryId,
    userId: input.userId,
    amountCents: input.amountCents,
    description: input.description?.trim() ? input.description.trim() : null,
    date: input.date,
  });
}

export async function softDeleteExpense(id: string): Promise<void> {
  await updateDoc(doc(expensesCol, id), { deletedAt: nowIso() });
}

/** Undo a soft delete — the balances refold on their own from the ledger. */
export async function restoreExpense(id: string): Promise<void> {
  await updateDoc(doc(expensesCol, id), { deletedAt: null });
}

/* ---- cashflow: recurring expenses & incomes ----------------------------- */

/** Shared input for both recurring expenses and incomes (identical shapes). */
export interface NewCashflowInput {
  name: string;
  amountCents: number;
  description?: string | null;
  startMonth?: MonthKey | null;
  endMonth?: MonthKey | null;
}

/** Editable fields common to a recurring expense / income doc. */
function cashflowFields(input: NewCashflowInput) {
  return {
    name: input.name.trim(),
    amountCents: input.amountCents,
    description: input.description?.trim() ? input.description.trim() : null,
    startMonth: monthOrNull(input.startMonth),
    endMonth: monthOrNull(input.endMonth),
  };
}

export async function addRecurringExpense(input: NewCashflowInput): Promise<void> {
  await addDoc(recurringExpensesCol, {
    ...cashflowFields(input),
    createdAt: nowIso(),
    deletedAt: null,
  });
}

export async function updateRecurringExpense(id: string, input: NewCashflowInput): Promise<void> {
  await updateDoc(doc(recurringExpensesCol, id), cashflowFields(input));
}

export async function softDeleteRecurringExpense(id: string): Promise<void> {
  await updateDoc(doc(recurringExpensesCol, id), { deletedAt: nowIso() });
}

export async function addIncome(input: NewCashflowInput): Promise<void> {
  await addDoc(incomesCol, { ...cashflowFields(input), createdAt: nowIso(), deletedAt: null });
}

export async function updateIncome(id: string, input: NewCashflowInput): Promise<void> {
  await updateDoc(doc(incomesCol, id), cashflowFields(input));
}

export async function softDeleteIncome(id: string): Promise<void> {
  await updateDoc(doc(incomesCol, id), { deletedAt: nowIso() });
}
