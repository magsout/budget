import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
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
export const expensesCol = collection(db, "expenses");

function nowIso(): string {
  return new Date().toISOString();
}

/* ---- users -------------------------------------------------------------- */

export async function addUser(firstName: string): Promise<void> {
  await addDoc(usersCol, { firstName: firstName.trim(), createdAt: nowIso() });
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
