import { useId } from "react";
import { formatDayShort, isToday } from "../lib/dates.ts";
import type { ExpenseDay } from "../lib/grouping.ts";
import { formatCents } from "../lib/money.ts";
import type { Category, Expense, User } from "../lib/types.ts";
import { ExpenseRow } from "./ExpenseRow.tsx";
import { ChevronDownIcon, ChevronRightIcon } from "./icons.tsx";

interface Props {
  day: ExpenseDay;
  categoryOf: (id: string) => Category | undefined;
  userOf: (id: string) => User | undefined;
  open: boolean;
  onToggle: () => void;
  onEdit?: (expense: Expense) => void;
}

/**
 * A day of expenses under a sticky header carrying its date, its row count and
 * its total — a number the app did not show anywhere before.
 *
 * The wrapping `<div>` is load-bearing: without one block per group, all eleven
 * sticky headers share `.card` as their containing block, stick at `top: 0`
 * together, and the OLDEST day ends up painted over the current one.
 */
export function DayGroup({ day, categoryOf, userOf, open, onToggle, onEdit }: Props) {
  const bodyId = useId();

  return (
    <div className="daygroup">
      <button
        type="button"
        className="daygroup__head"
        aria-expanded={open}
        // Omitted when closed: the body is unmounted, and pointing at an absent
        // id is a broken reference rather than a hidden one.
        aria-controls={open ? bodyId : undefined}
        onClick={onToggle}
      >
        <span className="daygroup__caret" aria-hidden>
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
        <span className="daygroup__label">
          {formatDayShort(day.date)}
          {isToday(day.date) && <span className="daygroup__meta"> · aujourd'hui</span>}
        </span>
        <span className="daygroup__count">
          {day.expenses.length} ligne{day.expenses.length > 1 ? "s" : ""}
        </span>
        <span className="daygroup__total num">{formatCents(day.totalCents)}</span>
      </button>
      {/* Rows are UNMOUNTED when closed, not hidden: a hidden row still counts in
          the DOM, which would make every row-counting assertion meaningless. */}
      {open && (
        <div id={bodyId} role="group" className="daygroup__body">
          {day.expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              category={categoryOf(expense.categoryId)}
              user={userOf(expense.userId)}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
