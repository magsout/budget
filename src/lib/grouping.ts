import type { DateKey } from "./dates.ts";
import type { Expense } from "./types.ts";

/**
 * Grouping a month's expense list into days. A flat list of 61 rows has no
 * reading level between "the month's total" and "one row"; a day is the level
 * that already exists in the data (the rows are sorted by date) and that people
 * actually think in ("what did we spend Saturday?").
 */

/** One day of a month's expense list, with its own total. */
export interface ExpenseDay {
  date: DateKey;
  expenses: Expense[];
  totalCents: number;
}

/**
 * Cut a list of expenses into days, in a single pass and WITHOUT re-sorting.
 *
 * `expensesForMonth` (lib/budget.ts) already orders rows by date descending then
 * `createdAt` descending, so consecutive rows of the same day are adjacent and in
 * the right order — splitting on each change of `date` is enough. Sorting here
 * would silently reorder rows within a day and lose that "most recently logged
 * first" tiebreak.
 *
 * Days with no expense are not represented: they hold nothing to show, and a
 * month would otherwise open with ~20 empty headers.
 */
export function groupExpensesByDay(expenses: Expense[]): ExpenseDay[] {
  const days: ExpenseDay[] = [];
  let current: ExpenseDay | null = null;

  for (const expense of expenses) {
    if (current === null || current.date !== expense.date) {
      current = { date: expense.date, expenses: [], totalCents: 0 };
      days.push(current);
    }
    current.expenses.push(expense);
    current.totalCents += expense.amountCents;
  }

  return days;
}

/**
 * Which days to show open. Without `maxRows`, every day — the list hides nothing
 * by default, because this is the screen you come to in order to check that an
 * expense went through.
 *
 * With `maxRows`, takes days from the top while the running row count stays under
 * the budget, and ALWAYS keeps at least one day open: landing on a list where
 * every group is collapsed looks like an empty screen, not like a folded one.
 */
export function defaultOpenDays(days: ExpenseDay[], opts?: { maxRows?: number }): DateKey[] {
  const maxRows = opts?.maxRows;
  if (maxRows === undefined) return days.map((d) => d.date);
  if (days.length === 0) return [];

  const open: DateKey[] = [days[0].date];
  let rows = days[0].expenses.length;
  for (const day of days.slice(1)) {
    if (rows + day.expenses.length > maxRows) break;
    open.push(day.date);
    rows += day.expenses.length;
  }
  return open;
}
