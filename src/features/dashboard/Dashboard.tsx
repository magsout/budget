import { useMemo, useState } from "react";
import { CategoryFilter } from "../../components/CategoryFilter.tsx";
import { ExpenseSearch } from "../../components/ExpenseSearch.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import {
  expensesForMonth,
  filterExpensesByCategory,
  monthSummary,
  spendByUser,
  totalRemaining,
} from "../../lib/budget.ts";
import { avatarColorFor } from "../../lib/colors.ts";
import { currentMonth, formatDate, formatMonth } from "../../lib/dates.ts";
import { carryLabel } from "../../lib/labels.ts";
import { formatCents } from "../../lib/money.ts";
import { searchExpenses } from "../../lib/search.ts";
import type { Dataset, Expense } from "../../lib/types.ts";
import { ExpenseForm } from "../expense/ExpenseForm.tsx";

type FormState =
  | { mode: "create"; categoryId?: string }
  | { mode: "edit"; expense: Expense }
  | null;

function remainingClass(remaining: number, starting: number): string {
  if (remaining < 0) return "negative";
  if (starting > 0 && remaining < starting * 0.15) return "warning";
  return "positive";
}

export function Dashboard({ dataset }: { dataset: Dataset }) {
  const month = currentMonth();
  const [form, setForm] = useState<FormState>(null);
  /** Poste filtering the month's expense list; null = tous. */
  const [filter, setFilter] = useState<string | null>(null);
  /** Free-text search over amounts and dates. */
  const [query, setQuery] = useState("");

  const summary = useMemo(() => monthSummary(dataset, month), [dataset, month]);
  const total = useMemo(() => totalRemaining(dataset, month), [dataset, month]);
  const expenses = useMemo(() => expensesForMonth(dataset, month), [dataset, month]);

  // Search first, then the poste chips — so the counts on the chips describe
  // what the search actually left, instead of promising rows it filtered out.
  const found = useMemo(() => searchExpenses(expenses, query), [expenses, query]);
  const visibleExpenses = filterExpensesByCategory(found, filter);
  const perUser = useMemo(() => spendByUser(expenses, dataset.users), [expenses, dataset.users]);

  const categoryName = (id: string) => dataset.categories.find((c) => c.id === id)?.name ?? "—";
  const userName = (id: string) => dataset.users.find((u) => u.id === id)?.firstName ?? "—";

  return (
    <div className="has-fab">
      <div className="card">
        <div className="summary">
          <div>
            <div className="summary__label">Reste ce mois ({formatMonth(month)})</div>
            <div className={`summary__value ${total < 0 ? "negative" : "positive"}`}>
              {formatCents(total)}
            </div>
          </div>
        </div>
      </div>

      {summary.length === 0 ? (
        <div className="card empty">
          Aucun poste de dépenses. Ajoute-en un dans l'onglet <strong>Config</strong>.
        </div>
      ) : (
        summary.map(({ category, state }) => {
          const cls = remainingClass(state.remainingCents, state.startingCents);
          const pct =
            state.startingCents > 0
              ? Math.min(100, Math.max(0, (state.spentCents / state.startingCents) * 100))
              : state.spentCents > 0
                ? 100
                : 0;
          const fillColor =
            cls === "negative"
              ? "var(--negative)"
              : cls === "warning"
                ? "var(--warning)"
                : "var(--positive)";
          return (
            <button
              type="button"
              key={category.id}
              className="card poste"
              onClick={() => setForm({ mode: "create", categoryId: category.id })}
              style={{ textAlign: "inherit", width: "100%", font: "inherit", color: "inherit" }}
            >
              <div className="poste__head">
                <span className="poste__name">
                  <span
                    className="poste__dot"
                    style={category.color ? { background: category.color } : undefined}
                  />
                  {category.name}
                </span>
                <span className={`poste__remaining ${cls}`}>
                  {formatCents(state.remainingCents)}
                </span>
              </div>
              <div className="bar">
                <div className="bar__fill" style={{ width: `${pct}%`, background: fillColor }} />
              </div>
              <div className="poste__meta">
                <span>
                  Dépensé {formatCents(state.spentCents)} / {formatCents(state.startingCents)}
                </span>
                {carryLabel(state) && <span>{carryLabel(state)}</span>}
              </div>
            </button>
          );
        })
      )}

      {perUser.length > 1 && (
        <div className="card">
          <h3>Qui a dépensé quoi</h3>
          {perUser.map(({ user, totalCents, count }) => (
            <div className="split" key={user.id}>
              <div className="split__head">
                <span className="poste__name">
                  <span
                    className="account-menu__avatar"
                    style={{ background: avatarColorFor(user.id) }}
                    aria-hidden
                  >
                    {user.firstName.charAt(0).toUpperCase()}
                  </span>
                  {user.firstName}
                </span>
                <span>
                  <strong>{formatCents(totalCents)}</strong>{" "}
                  <span className="muted">
                    · {count} dépense{count > 1 ? "s" : ""}
                  </span>
                </span>
              </div>
              <div className="bar">
                <div
                  className="bar__fill"
                  style={{
                    width: `${(totalCents / perUser[0].totalCents) * 100}%`,
                    background: avatarColorFor(user.id),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {expenses.length > 0 && (
        <div className="card">
          <h3>Dépenses du mois</h3>
          <ExpenseSearch value={query} onChange={setQuery} />
          <CategoryFilter
            expenses={found}
            categories={dataset.categories}
            value={filter}
            onChange={setFilter}
          />
          {visibleExpenses.length === 0 && (
            <p className="muted">Aucune dépense ne correspond à cette recherche.</p>
          )}
          {visibleExpenses.map((e) => (
            <button
              type="button"
              key={e.id}
              className="list-item list-item--btn"
              onClick={() => setForm({ mode: "edit", expense: e })}
            >
              <div>
                <div>
                  <strong>{formatCents(e.amountCents)}</strong> · {categoryName(e.categoryId)}
                </div>
                <div className="muted">
                  {formatDate(e.date)} · {userName(e.userId)}
                  {e.description ? ` · ${e.description}` : ""}
                </div>
              </div>
              <span className="muted" aria-hidden="true">
                ✏️
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Icon-only, so the label has to come from aria-label. */}
      <button
        type="button"
        className="fab"
        aria-label="Ajouter une dépense"
        onClick={() => setForm({ mode: "create" })}
      >
        <PlusIcon />
      </button>

      {form && (
        <ExpenseForm
          dataset={dataset}
          onClose={() => setForm(null)}
          defaultCategoryId={form.mode === "create" ? form.categoryId : undefined}
          expense={form.mode === "edit" ? form.expense : undefined}
        />
      )}
    </div>
  );
}
