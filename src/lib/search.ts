/**
 * Free-text search over a month's expenses, on amount and date.
 *
 * One field rather than two: a query is matched against everything an expense
 * can be recognised by, and several terms are ANDed — so "42" narrows by
 * amount, "7 août" by date, and "42 août" by both at once. That covers the
 * "montant et/ou date" case without asking which field you meant.
 */
import { formatDate, formatMonth, monthOf } from "./dates.ts";
import { centsToInput } from "./money.ts";
import type { Expense } from "./types.ts";

/** Lowercase and strip accents, so "aout" finds "août". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Every written form of an expense's amount and date, concatenated. Built to be
 * forgiving: 42,50 is found by "42", "42,5" or "42.50", and the 7th of August
 * by "7", "07/08", "7/8" or "7 aout".
 */
function haystack(expense: Expense): string {
  const amount = centsToInput(expense.amountCents); // "42,50"
  const [year, month, day] = expense.date.split("-");
  return normalize(
    [
      amount,
      amount.replace(",", "."),
      amount.split(",")[0], // whole euros
      expense.date, // 2026-08-07
      `${day}/${month}`,
      `${day}/${month}/${year}`,
      `${Number(day)}/${Number(month)}`, // 7/8, without the padding
      formatDate(expense.date), // 7 sept. 2026 — abbreviated month
      formatMonth(monthOf(expense.date)), // Septembre 2026 — spelled out
    ].join(" "),
  );
}

/**
 * Expenses matching every whitespace-separated term of `query`. A blank query
 * returns the list untouched, so callers can pass the raw input straight in.
 */
export function searchExpenses(expenses: Expense[], query: string): Expense[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return expenses;
  return expenses.filter((expense) => {
    const hay = haystack(expense);
    return terms.every((term) => hay.includes(term));
  });
}
