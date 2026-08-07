import { useState } from "react";
import { filterExpensesByCategory } from "../lib/budget.ts";
import { formatDate } from "../lib/dates.ts";
import { formatCents } from "../lib/money.ts";
import { searchExpenses } from "../lib/search.ts";
import type { Category, Expense, User } from "../lib/types.ts";
import { CategoryFilter } from "./CategoryFilter.tsx";
import { ExpenseSearch } from "./ExpenseSearch.tsx";
import { PencilIcon } from "./icons.tsx";

interface Props {
  /** The month's rows, already excluding deleted ones. */
  expenses: Expense[];
  categories: Category[];
  users: User[];
  /** When given, each row becomes a button that opens the expense for editing. */
  onEdit?: (expense: Expense) => void;
}

/**
 * A month's expense list with its search field and its per-poste chips — the
 * whole strip, not just the input. Budget and Historique show the same rows;
 * editability is the only difference between them, so it is the only prop.
 *
 * Owning the query here also keeps the screens from re-rendering on every
 * keystroke, which is what used to re-run their month-wide folds.
 *
 * Searching happens BEFORE the chips so their counts describe what the search
 * actually left, instead of promising rows it filtered out.
 */
export function ExpenseList({ expenses, categories, users, onEdit }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const found = searchExpenses(expenses, query);
  const visible = filterExpensesByCategory(found, filter);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";
  const userName = (id: string) => users.find((u) => u.id === id)?.firstName ?? "—";

  const body = (expense: Expense) => (
    <div>
      <div>
        <strong>{formatCents(expense.amountCents)}</strong> · {categoryName(expense.categoryId)}
      </div>
      <div className="muted">
        {formatDate(expense.date)} · {userName(expense.userId)}
        {expense.description ? ` · ${expense.description}` : ""}
      </div>
    </div>
  );

  return (
    <>
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
      {visible.map((expense) =>
        onEdit ? (
          <button
            type="button"
            key={expense.id}
            className="list-item list-item--btn"
            onClick={() => onEdit(expense)}
          >
            {body(expense)}
            <span className="list-item__edit">
              <PencilIcon />
            </span>
          </button>
        ) : (
          <div className="list-item" key={expense.id}>
            {body(expense)}
          </div>
        ),
      )}
    </>
  );
}
