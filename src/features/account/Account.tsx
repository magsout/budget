import { useMemo, useState } from "react";
import { accountSummary, incomesActiveIn, recurringExpensesActiveIn } from "../../lib/account.ts";
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
  const { incomeCents, expenseCents, remainingCents } = useMemo(
    () => accountSummary(dataset, month),
    [dataset, month],
  );

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
        </div>
        <div className="cashflow-totals">
          <span>
            Revenus <strong className="positive">{formatCents(incomeCents)}</strong>
          </span>
          <span>
            Dépenses <strong>{formatCents(expenseCents)}</strong>
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
