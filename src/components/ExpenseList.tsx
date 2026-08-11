import { useEffect, useMemo, useState } from "react";
import { filterExpensesByCategory } from "../lib/budget.ts";
import type { DateKey } from "../lib/dates.ts";
import { defaultOpenDays, groupExpensesByDay } from "../lib/grouping.ts";
import { formatCents } from "../lib/money.ts";
import { readListFolded, writeListFolded } from "../lib/prefs.ts";
import { searchExpenses } from "../lib/search.ts";
import { sumAmountCents } from "../lib/shape.ts";
import type { Category, Expense, User } from "../lib/types.ts";
import { CategoryFilter } from "./CategoryFilter.tsx";
import { DayGroup } from "./DayGroup.tsx";
import { ExpenseSearch } from "./ExpenseSearch.tsx";

interface Props {
  /** Distinguishes the two lists when remembering the fold mode. */
  id: "budget" | "history";
  title: string;
  /** The month's rows, already excluding deleted ones. */
  expenses: Expense[];
  categories: Category[];
  users: User[];
  /** When given, each row becomes a button that opens the expense for editing. */
  onEdit?: (expense: Expense) => void;
}

/**
 * A month's expense list: its own card head, its search field, its per-poste chips
 * and its rows grouped into days. Budget and Historique show the same thing;
 * editability is the only difference between them, so it is the only prop that
 * changes — the head lives here rather than in each screen so the count, the
 * total and the fold button cannot drift apart between the two.
 *
 * Owning the query here also keeps the screens from re-rendering on every
 * keystroke, which is what used to re-run their month-wide folds.
 *
 * Searching happens BEFORE the chips so their counts describe what the search
 * actually left, instead of promising rows it filtered out.
 */
export function ExpenseList({ id, title, expenses, categories, users, onEdit }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [folded, setFolded] = useState(() => readListFolded(window.localStorage, id));
  /** Per-day taps, which win over whatever the mode decided. */
  const [overrides, setOverrides] = useState<Map<DateKey, boolean>>(new Map());

  const found = searchExpenses(expenses, query);
  const visible = filterExpensesByCategory(found, filter);
  const days = useMemo(() => groupExpensesByDay(visible), [visible]);

  const searching = query !== "" || filter !== null;

  /**
   * Only the MODE is remembered, never a set of dates: a stored list of days
   * would go stale the moment the month rolls over. So the per-day taps are
   * dropped whenever the thing they were answering changes.
   */
  useEffect(() => {
    setOverrides(new Map());
  }, [query, filter, folded]);

  const openByDefault = useMemo(
    // Folded keeps only the most recent day; searching always opens everything —
    // a search that returns eleven closed boxes looks like it found nothing.
    () =>
      new Set(
        searching
          ? days.map((d) => d.date)
          : defaultOpenDays(days, folded ? { maxRows: 0 } : undefined),
      ),
    [days, folded, searching],
  );

  const categoryOf = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    return (cid: string) => byId.get(cid);
  }, [categories]);

  const userOf = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return (uid: string) => byId.get(uid);
  }, [users]);

  const toggleFolded = () => {
    const next = !folded;
    setFolded(next);
    writeListFolded(window.localStorage, id, next);
  };

  return (
    <>
      <div className="card__head">
        <h3>{title}</h3>
        {/* The month's total, not the filtered one — the chips already announce
            how many rows the current filter left. Kept a direct child of the head
            so that on a narrow screen the title and the total stay together on
            the first line and only the button drops below. */}
        <span className="card__head-total num">
          {expenses.length} · {formatCents(sumAmountCents(expenses))}
        </span>
        {days.length > 1 && (
          <span className="card__head-actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              aria-pressed={folded}
              onClick={toggleFolded}
            >
              {folded ? "Tout déplier" : "Tout replier"}
            </button>
          </span>
        )}
      </div>

      <ExpenseSearch value={query} onChange={setQuery} />
      <CategoryFilter
        expenses={found}
        categories={categories}
        value={filter}
        onChange={setFilter}
      />
      {visible.length === 0 && (
        <p className="muted">Aucune dépense ne correspond à cette recherche.</p>
      )}
      {days.map((day) => (
        <DayGroup
          key={day.date}
          day={day}
          categoryOf={categoryOf}
          userOf={userOf}
          open={overrides.get(day.date) ?? openByDefault.has(day.date)}
          onToggle={() =>
            setOverrides((prev) => {
              const next = new Map(prev);
              next.set(day.date, !(prev.get(day.date) ?? openByDefault.has(day.date)));
              return next;
            })
          }
          onEdit={onEdit}
        />
      ))}
    </>
  );
}
