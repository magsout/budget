import { useMemo, useState } from "react";
import { ExpenseList } from "../../components/ExpenseList.tsx";
import { PlusIcon } from "../../components/icons.tsx";
import { PosteRows } from "../../components/PosteRows.tsx";
import { StackBar } from "../../components/StackBar.tsx";
import { expensesForMonth, monthSummary, spendByUser, totalRemaining } from "../../lib/budget.ts";
import { avatarColorFor } from "../../lib/colors.ts";
import { currentMonth, formatMonth, nextMonth } from "../../lib/dates.ts";
import { formatCents } from "../../lib/money.ts";
import { sumAmountCents } from "../../lib/shape.ts";
import type { Dataset, Expense } from "../../lib/types.ts";
import { ExpenseForm } from "../expense/ExpenseForm.tsx";

type FormState =
  | { mode: "create"; categoryId?: string }
  | { mode: "edit"; expense: Expense }
  | null;

export function Dashboard({ dataset, onRebalance }: { dataset: Dataset; onRebalance: () => void }) {
  const month = currentMonth();
  const [form, setForm] = useState<FormState>(null);

  const summary = useMemo(() => monthSummary(dataset, month), [dataset, month]);
  const total = useMemo(() => totalRemaining(dataset, month), [dataset, month]);
  const expenses = useMemo(() => expensesForMonth(dataset, month), [dataset, month]);
  const perUser = useMemo(() => spendByUser(expenses, dataset.users), [expenses, dataset.users]);
  const spentTotal = useMemo(() => sumAmountCents(expenses), [expenses]);

  // Framed on the month that will INHERIT these reports, not on this one: by the
  // time a poste shows a negative carry-in it is already too late to decide where
  // it should have landed. The Dashboard is pinned to the current month, so this
  // is the only place the warning can be raised early.
  const sinking = useMemo(() => summary.filter((s) => s.state.remainingCents < 0), [summary]);

  return (
    <div className="has-fab">
      {/* One card for the month: what is left, and the postes that explain it.
          They used to be four cards, which spent ~120px of padding and shadow
          separating figures that are only meaningful together. */}
      <div className="card monthcard">
        <div className="summary">
          <div>
            <div className="summary__label">Reste ce mois ({formatMonth(month)})</div>
            <div className={`summary__value num ${total < 0 ? "negative" : "positive"}`}>
              {formatCents(total)}
            </div>
          </div>
        </div>

        {summary.length === 0 ? (
          <p className="muted">
            Aucun poste de dépenses. Ajoute-en un dans les <strong>Réglages</strong>.
          </p>
        ) : (
          <PosteRows
            summary={summary}
            onPick={(categoryId) => setForm({ mode: "create", categoryId })}
          />
        )}
      </div>

      {sinking.length > 0 && (
        <button type="button" className="card card--nudge" onClick={onRebalance}>
          <span>
            <strong>
              {sinking.length === 1
                ? `1 poste démarrera ${formatMonth(nextMonth(month))} dans le rouge`
                : `${sinking.length} postes démarreront ${formatMonth(nextMonth(month))} dans le rouge`}
            </strong>
            <span className="muted">
              {" "}
              — choisis qui porte le report, ou place un apport dessus.
            </span>
          </span>
          <span className="card--nudge__cta">Répartir</span>
        </button>
      )}

      {perUser.length > 1 && (
        <div className="card">
          <div className="card__head">
            <h3>Qui a dépensé quoi</h3>
            <span className="card__head-total num">{formatCents(spentTotal)}</span>
          </div>
          {/* Shares of the month's total, not of the biggest spender: normalised
              that way, the top contributor was always a full bar. */}
          <StackBar
            totalCents={spentTotal}
            segments={perUser.map(({ user, totalCents, count }) => ({
              key: user.id,
              label: user.firstName,
              cents: totalCents,
              color: avatarColorFor(user.id),
              count,
            }))}
          />
        </div>
      )}

      {expenses.length > 0 && (
        <div className="card">
          <ExpenseList
            id="budget"
            title="Dépenses du mois"
            expenses={expenses}
            categories={dataset.categories}
            users={dataset.users}
            onEdit={(expense) => setForm({ mode: "edit", expense })}
          />
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
