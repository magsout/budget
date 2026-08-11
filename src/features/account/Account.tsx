import { useMemo, useState } from "react";
import { MonthNav } from "../../components/MonthNav.tsx";
import { StackBar } from "../../components/StackBar.tsx";
import {
  accountSummary,
  type CategoryBudgetLine,
  categoryBudgetsActiveIn,
  incomesActiveIn,
  recurringExpensesActiveIn,
} from "../../lib/account.ts";
import { posteColor } from "../../lib/colors.ts";
import { currentMonth, formatMonth } from "../../lib/dates.ts";
import { formatCents } from "../../lib/money.ts";
import { formatPct, share, sumAmountCents } from "../../lib/shape.ts";
import type { Dataset, Income, RecurringExpense } from "../../lib/types.ts";

/**
 * Cashflow tab: monthly income vs recurring expenses. Read-only — items are
 * created/edited in the Config (Réglages) sub-page.
 *
 * Every line stays visible. There is no grouping by kind of charge, because
 * `RecurringExpense` has no such field and every way of deriving one (amount
 * bands, a Pareto fold) names its own algorithm and moves a line because ANOTHER
 * line changed. The existing "largest first" order already answers "where does
 * the money go", for free.
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
      <div className="card">
        {/* Inside the card it drives, not floating above everything: the stepper
            changes what this card says, so it belongs to it. */}
        <MonthNav month={month} onChange={setMonth} className="month-nav--inline" />

        {/* Two figures of unequal importance, so unequal weight. "Reste après
            budgets" is the one that decides whether there is money to spend, but
            it only makes sense next to the gross figure. */}
        <div className="summary summary--stack">
          <div className="summary__row">
            <span className="summary__label">Reste ({formatMonth(month)})</span>
            <span className={`summary__value num ${remainingCents < 0 ? "negative" : "positive"}`}>
              {formatCents(remainingCents)}
            </span>
          </div>
          <div className="summary__row">
            <span className="summary__label summary__label--sub">après budgets</span>
            <span
              className={`summary__value summary__value--sub num ${
                remainingAfterBudgetsCents < 0 ? "negative" : "positive"
              }`}
            >
              {formatCents(remainingAfterBudgetsCents)}
            </span>
          </div>
        </div>

        {/* Replaces a flex row of three unrelated figures that crowded each other
            at 390px. As one bar it answers the question those figures raised but
            never explained: where the income went, and why so little is left. */}
        <StackBar
          totalCents={incomeCents}
          note={`sur ${formatCents(incomeCents)} de revenus`}
          segments={[
            {
              key: "expenses",
              label: "dépenses",
              cents: expenseCents,
              color: "var(--text-muted)",
            },
            { key: "budgets", label: "budgets", cents: budgetCents, color: "var(--primary)" },
          ]}
        />
      </div>

      {/* Two short lists side by side rather than two cards stacked: three rows
          each never needed a card of their own. */}
      <div className="card">
        <div className="duo">
          <CashflowSection
            title="Revenus"
            emptyLabel="Aucun revenu ce mois-ci."
            items={incomes}
            positive
          />
          <BudgetSection items={budgets} total={budgetCents} />
        </div>
      </div>

      <div className="card">
        <CashflowSection
          title="Dépenses mensuelles"
          emptyLabel="Aucune dépense mensuelle ce mois-ci."
          items={expenses}
        />
      </div>
    </div>
  );
}

function CashflowSection({
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
  const total = sumAmountCents(items);

  return (
    <section>
      <div className="card__head">
        <h3>{title}</h3>
        <span className="card__head-total num">{formatCents(total)}</span>
      </div>
      {items.length === 0 ? (
        <p className="muted">{emptyLabel}</p>
      ) : (
        items.map((it) => (
          <div className="cash-row" key={it.id}>
            <span className="cash-row__name">{it.name}</span>
            {/* The weight of each line, which existed nowhere: "the mortgage is
                36% of my charges" used to require dividing in your head. */}
            <span className="cash-row__pct num muted">
              {formatPct(share(it.amountCents, total))}
            </span>
            <span className={`cash-row__amount num ${positive ? "positive" : ""}`}>
              {formatCents(it.amountCents)}
            </span>
            {it.description && <span className="cash-row__desc muted">{it.description}</span>}
          </div>
        ))
      )}
    </section>
  );
}

/**
 * The category budgets deducted from the cashflow. Read-only mirror of the
 * postes de dépenses — each line is the poste's allocated monthly budget, so
 * they're managed in Réglages, not here.
 */
function BudgetSection({ items, total }: { items: CategoryBudgetLine[]; total: number }) {
  return (
    <section>
      <div className="card__head">
        <h3>Budgets</h3>
        <span className="card__head-total num">{formatCents(total)}</span>
      </div>
      {items.length === 0 ? (
        <p className="muted">Aucun budget ce mois-ci.</p>
      ) : (
        items.map(({ category, amountCents }) => (
          <div className="cash-row" key={category.id}>
            <span className="cash-row__name poste__name">
              <span
                className="poste__dot"
                style={{ background: posteColor(category) }}
                aria-hidden
              />
              {category.name}
            </span>
            <span className="cash-row__pct num muted">{formatPct(share(amountCents, total))}</span>
            <span className="cash-row__amount num">{formatCents(amountCents)}</span>
          </div>
        ))
      )}
    </section>
  );
}
