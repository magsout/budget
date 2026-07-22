import { useMemo, useState } from "react";
import {
  availableMonths,
  expensesForMonth,
  monthSummary,
  totalRemaining,
} from "../../lib/budget.ts";
import { currentMonth, formatDate, formatMonth, prevMonth } from "../../lib/dates.ts";
import { formatCents } from "../../lib/money.ts";
import type { Dataset } from "../../lib/types.ts";

export function History({ dataset }: { dataset: Dataset }) {
  const current = currentMonth();
  // Past months only (exclude the current month, which lives on the dashboard).
  const months = useMemo(
    () => availableMonths(dataset, prevMonth(current)).toReversed(),
    [dataset, current],
  );

  const [selected, setSelected] = useState(months[0] ?? "");

  if (months.length === 0) {
    return <div className="card empty">Aucun mois archivé pour l'instant.</div>;
  }

  const month = months.includes(selected) ? selected : months[0];
  const summary = monthSummary(dataset, month);
  const expenses = expensesForMonth(dataset, month);
  const total = totalRemaining(dataset, month);

  const categoryName = (id: string) => dataset.categories.find((c) => c.id === id)?.name ?? "—";
  const userName = (id: string) => dataset.users.find((u) => u.id === id)?.firstName ?? "—";

  return (
    <div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {months.map((m) => (
          <button
            type="button"
            key={m}
            className={`chip ${m === month ? "chip--active" : ""}`}
            onClick={() => setSelected(m)}
          >
            {formatMonth(m)}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="summary">
          <div>
            <div className="summary__label">Solde fin {formatMonth(month)}</div>
            <div className={`summary__value ${total < 0 ? "negative" : "positive"}`}>
              {formatCents(total)}
            </div>
          </div>
        </div>
      </div>

      {summary.map(({ category, state }) => (
        <div className="card poste" key={category.id}>
          <div className="poste__head">
            <span className="poste__name">
              <span
                className="poste__dot"
                style={category.color ? { background: category.color } : undefined}
              />
              {category.name}
            </span>
            <span
              className={`poste__remaining ${state.remainingCents < 0 ? "negative" : "positive"}`}
            >
              {formatCents(state.remainingCents)}
            </span>
          </div>
          <div className="poste__meta">
            <span>
              Budget {formatCents(state.startingCents)} · dépensé {formatCents(state.spentCents)}
            </span>
            {state.carryInCents !== 0 && <span>Report {formatCents(state.carryInCents)}</span>}
          </div>
        </div>
      ))}

      {expenses.length > 0 && (
        <div className="card">
          <h3>Dépenses</h3>
          {expenses.map((e) => (
            <div className="list-item" key={e.id}>
              <div>
                <div>
                  <strong>{formatCents(e.amountCents)}</strong> · {categoryName(e.categoryId)}
                </div>
                <div className="muted">
                  {formatDate(e.date)} · {userName(e.userId)}
                  {e.description ? ` · ${e.description}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
