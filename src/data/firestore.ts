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
