import { useMemo, useState } from "react";
import { ExpenseList } from "../../components/ExpenseList.tsx";
import {
  availableMonths,
  expensesForMonth,
  type MonthState,
  monthSummary,
  recentTimeline,
  totalRemaining,
} from "../../lib/budget.ts";
import { currentMonth, formatMonth, prevMonth } from "../../lib/dates.ts";
import { carryLabel } from "../../lib/labels.ts";
import { formatCents } from "../../lib/money.ts";
import type { Category, Dataset } from "../../lib/types.ts";

/** How many months of history a poste's trend shows when expanded. */
const TREND_MONTHS = 6;

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
        <PosteRow
          key={category.id}
          category={category}
          state={state}
          dataset={dataset}
          month={month}
        />
      ))}

      {expenses.length > 0 && (
        <div className="card">
          <h3>Dépenses</h3>
          <ExpenseList expenses={expenses} categories={dataset.categories} users={dataset.users} />
        </div>
      )}
    </div>
  );
}

/**
 * One poste's month, expandable into its recent trend. The trend lives here
 * rather than on the Budget tab because a poste card there is already the
 * "ajouter une dépense à ce poste" button — giving it a second meaning would
 * break that gesture.
 */
function PosteRow({
  category,
  state,
  dataset,
  month,
}: {
  category: Category;
  state: MonthState;
  dataset: Dataset;
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const trend = open ? recentTimeline(dataset, category.id, month, TREND_MONTHS) : [];

  return (
    <div className="card poste">
      <button
        type="button"
        className="poste__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
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
          {carryLabel(state) && <span>{carryLabel(state)}</span>}
        </div>
      </button>
      {open && <Trend rows={trend} />}
    </div>
  );
}

/** Spent vs available, month by month. CSS bars — no charting dependency. */
function Trend({ rows }: { rows: MonthState[] }) {
  if (rows.length === 0) return <p className="muted">Pas d'historique pour ce poste.</p>;
  // Scale every bar against the largest value on show, so months stay comparable.
  const peak = Math.max(...rows.map((r) => Math.max(r.spentCents, r.startingCents)), 1);

  return (
    <div className="trend">
      {rows.map((r) => (
        <div className="trend__row" key={r.month}>
          <span className="trend__label">{formatMonth(r.month).replace(/ \d{4}$/, "")}</span>
          <span className="trend__bars">
            <span
              className="trend__bar trend__bar--budget"
              style={{ width: `${(r.startingCents / peak) * 100}%` }}
            />
            <span
              className={`trend__bar ${r.spentCents > r.startingCents ? "trend__bar--over" : "trend__bar--spent"}`}
              style={{ width: `${(r.spentCents / peak) * 100}%` }}
            />
          </span>
          <span className="trend__value">{formatCents(r.spentCents)}</span>
        </div>
      ))}
      <p className="muted">Dépensé (barre pleine) rapporté au budget disponible (barre claire).</p>
    </div>
  );
}
