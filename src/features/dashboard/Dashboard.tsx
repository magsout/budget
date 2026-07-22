import { useMemo, useState } from "react";
import { expensesForMonth, monthSummary, totalRemaining } from "../../lib/budget.ts";
import { currentMonth, formatDate, formatMonth } from "../../lib/dates.ts";
import { formatCents } from "../../lib/money.ts";
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

  const summary = useMemo(() => monthSummary(dataset, month), [dataset, month]);
  const total = useMemo(() => totalRemaining(dataset, month), [dataset, month]);
  const expenses = useMemo(() => expensesForMonth(dataset, month), [dataset, month]);

  const categoryName = (id: string) => dataset.categories.find((c) => c.id === id)?.name ?? "—";
  const userName = (id: string) => dataset.users.find((u) => u.id === id)?.firstName ?? "—";

  return (
    <div>
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
                {state.carryInCents !== 0 && <span>Report {formatCents(state.carryInCents)}</span>}
              </div>
            </button>
          );
        })
      )}

      {expenses.length > 0 && (
        <div className="card">
          <h3>Dépenses du mois</h3>
          {expenses.map((e) => (
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

      <button type="button" className="fab" onClick={() => setForm({ mode: "create" })}>
        + Ajouter une dépense
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
