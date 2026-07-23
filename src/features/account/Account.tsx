import { useMemo, useState } from "react";
import {
  accountSummary,
  type CategoryBudgetLine,
  categoryBudgetsActiveIn,
  incomesActiveIn,
  recurringExpensesActiveIn,
} from "../../lib/account.ts";
import { currentMonth, formatMonth, nextMonth, prevMonth } from "../../lib/dates.ts";
import { formatCents } from "../../lib/money.ts";
import type { Dataset, Income, RecurringExpense } from "../../lib/types.ts";

/**
 * Cashflow tab: monthly income vs recurring expenses. Read-only — items are
 * created/edited in the Config (Réglages) sub-page. The month stepper is
 * unbounded so future months preview planned items (and past months recall them).
 */
export function Account({ dataset }: { dataset: Dataset }) {
  const [month, setMonth] = useState(currentMonth());

  const incomes = useMemo(() => incomesActiveIn(dataset, month), [dataset, month]);
  const expenses = useMemo(() => recurringExpensesActiveIn(dataset, month), [dataset, month]);
  const budgets = useMemo(() => categoryBudgetsActiveIn(dataset, month), [dataset, month]);
  const { incomeCents, expenseCents, remainingCents, budgetCents, remainingAfterBudgetsCents } =
    useMemo(() => accountSummary(dataset, month), [dataset, month]);

  return (
    <div>
      <div className="month-nav">
        <button
          type="button"
          className="btn btn--ghost month-nav__btn"
          onClick={() => setMonth((m) => prevMonth(m))}
          aria-label="Mois précédent"
        >
          ‹
        </button>
        <span className="month-nav__label">{formatMonth(month)}</span>
        <button
          type="button"
          className="btn btn--ghost month-nav__btn"
          onClick={() => setMonth((m) => nextMonth(m))}
          aria-label="Mois suivant"
        >
          ›
        </button>
      </div>

      <div className="card">
        <div className="summary">
          <div>
            <div className="summary__label">Reste ({formatMonth(month)})</div>
            <div className={`summary__value ${remainingCents < 0 ? "negative" : "positive"}`}>
              {formatCents(remainingCents)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="summary__label">Reste après budgets</div>
            <div
              className={`summary__value ${remainingAfterBudgetsCents < 0 ? "negative" : "positive"}`}
            >
              {formatCents(remainingAfterBudgetsCents)}
            </div>
          </div>
        </div>
        <div className="cashflow-totals">
          <span>
            Revenus <strong className="positive">{formatCents(incomeCents)}</strong>
          </span>
          <span>
            Dépenses <strong>{formatCents(expenseCents)}</strong>
          </span>
          <span>
            Budgets <strong>{formatCents(budgetCents)}</strong>
          </span>
        </div>
      </div>

      <CashflowList
        title="Revenus"
        emptyLabel="Aucun revenu ce mois-ci."
        items={incomes}
        positive
      />
      <CashflowList
        title="Dépenses mensuelles"
        emptyLabel="Aucune dépense mensuelle ce mois-ci."
        items={expenses}
      />
      <BudgetList items={budgets} />
    </div>
  );
}

function CashflowList({
  title,
  emptyLabel,
  items,
  positive = false,
}: {
  title: string;
  emptyLabel: string;
  items: (RecurringExpense | Income)[];
  positive?: boolean;
}) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">{emptyLabel}</p>
      ) : (
        items.map((it) => (
          <div className="list-item" key={it.id}>
            <div>
              <strong>{it.name}</strong>
              {it.description && <div className="muted">{it.description}</div>}
            </div>
            <span className={positive ? "positive" : undefined}>{formatCents(it.amountCents)}</span>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * The category budgets deducted from the cashflow. Read-only mirror of the
 * postes de dépenses — each line is the poste's allocated monthly budget, so
 * they're managed in Réglages, not here.
 */
function BudgetList({ items }: { items: CategoryBudgetLine[] }) {
  return (
    <div className="card">
      <h3>Budgets</h3>
      {items.length === 0 ? (
        <p className="muted">Aucun budget ce mois-ci.</p>
      ) : (
        items.map(({ category, amountCents }) => (
          <div className="list-item" key={category.id}>
            <span className="poste__name">
              <span
                className="poste__dot"
                style={category.color ? { background: category.color } : undefined}
              />
              {category.name}
            </span>
            <span>{formatCents(amountCents)}</span>
          </div>
        ))
      )}
    </div>
  );
}
