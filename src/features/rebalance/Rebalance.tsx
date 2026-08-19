import { useMemo, useState } from "react";
import { MonthNav } from "../../components/MonthNav.tsx";
import { useData } from "../../data/DataContext.tsx";
import { replaceBudgetMovements, softDeleteBudgetMovement } from "../../data/firestore.ts";
import { oneOffIncomesIn } from "../../lib/account.ts";
import { categoriesActiveIn, monthStateFor } from "../../lib/budget.ts";
import { posteColor } from "../../lib/colors.ts";
import { currentMonth, formatMonth, type MonthKey, nextMonth } from "../../lib/dates.ts";
import { centsToInput, eurosToCents, formatCents, isValidAmount } from "../../lib/money.ts";
import {
  movementsIn,
  proposeRepartition,
  type RepartitionRow,
  repartitionDrift,
  repartitionToMovements,
  spreadOverShortfalls,
} from "../../lib/movements.ts";
import { syncErrorMessage } from "../../lib/sync.ts";
import type { Category, Dataset } from "../../lib/types.ts";

/**
 * Where a month's reports get redistributed and a one-off income gets placed.
 *
 * A sub-page rather than a tab, like Réglages: it owns a « ‹ Retour » and no tab
 * could legitimately read as active here. It carries its own month stepper —
 * unbounded, so September's reports can be sorted out in August, before the month
 * that inherits them begins. That is the whole reason this is not a section of
 * the Dashboard, which is pinned to the current month.
 */
export function Rebalance({ dataset }: { dataset: Dataset }) {
  // Defaults to next month: the report you want to redirect is the one about to
  // land, and the gesture is worth making before it does.
  const [month, setMonth] = useState<MonthKey>(nextMonth(currentMonth()));

  return (
    <div>
      <div className="card">
        <MonthNav month={month} onChange={setMonth} className="month-nav--inline" />
        <p className="muted">
          Le report de chaque poste peut être déplacé vers un autre : le total ne change pas, tu
          choisis seulement qui le porte.
        </p>
      </div>
      <RepartitionSection dataset={dataset} month={month} />
      <ApportSection dataset={dataset} month={month} />
      <MovementsSection dataset={dataset} month={month} />
    </div>
  );
}

interface Draft extends RepartitionRow {
  category: Category;
  /** Raw field text, so a half-typed "-" or "," is not fought while typing. */
  input: string;
}

/** Priority order = the poste order the ↑↓ arrows in Réglages already define. */
function draftsFor(dataset: Dataset, month: MonthKey): Draft[] {
  return categoriesActiveIn(dataset, month)
    .toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((category) => {
      const carryInCents = monthStateFor(dataset, category.id, month)?.carryInCents ?? 0;
      return {
        category,
        categoryId: category.id,
        carryInCents,
        adjustedCents: carryInCents,
        input: centsToInput(carryInCents),
      };
    });
}

function RepartitionSection({ dataset, month }: { dataset: Dataset; month: MonthKey }) {
  const { notifyError } = useData();
  const base = useMemo(() => draftsFor(dataset, month), [dataset, month]);
  // Keyed by month so stepping the stepper abandons a half-made draft rather
  // than carrying figures from one month onto another.
  const [edits, setEdits] = useState<{ month: MonthKey; rows: Draft[] } | null>(null);
  const rows = edits?.month === month ? edits.rows : base;

  const setRows = (next: Draft[]) => setEdits({ month, rows: next });
  const patch = (categoryId: string, input: string) =>
    setRows(
      rows.map((r) =>
        r.categoryId === categoryId
          ? {
              ...r,
              input,
              adjustedCents: isValidAmount(input) ? eurosToCents(input) : r.adjustedCents,
            }
          : r,
      ),
    );

  const propose = () =>
    setRows(proposeRepartition(rows).map((r) => ({ ...r, input: centsToInput(r.adjustedCents) })));

  const drift = repartitionDrift(rows);
  const anyInvalid = rows.some((r) => !isValidAmount(r.input));
  const touched = rows.some((r) => r.adjustedCents !== r.carryInCents);
  const totalCents = rows.reduce((s, r) => s + r.carryInCents, 0);

  const save = () => {
    if (drift !== 0 || anyInvalid) return;
    replaceBudgetMovements(month, "transfer", repartitionToMovements(rows, month)).catch(
      (err: unknown) => notifyError(syncErrorMessage("répartition du report", err)),
    );
    setEdits(null);
  };

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="card__head">
          <h3>Répartir le report</h3>
        </div>
        <p className="muted">Aucun poste actif sur {formatMonth(month)}.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card__head">
        <h3>Répartir le report</h3>
        <span className="card__head-total num">{formatCents(totalCents)}</span>
      </div>

      {rows.map((r) => (
        <div className="mv-row" key={r.categoryId}>
          <span className="poste__name">
            <span
              className="poste__dot"
              style={{ background: posteColor(r.category) }}
              aria-hidden
            />
            <strong>{r.category.name}</strong>
          </span>
          {/* The computed report stays next to the field: the point of the
              gesture is seeing what you are moving away from. */}
          <span className="mv-row__from muted num">{formatCents(r.carryInCents)} →</span>
          <input
            className="input mv-row__field"
            inputMode="text"
            value={r.input}
            onChange={(e) => patch(r.categoryId, e.target.value)}
            aria-label={`Report ajusté de ${r.category.name}`}
          />
        </div>
      ))}

      {anyInvalid ? (
        <p className="muted negative">Montant invalide (un report peut être négatif).</p>
      ) : drift !== 0 ? (
        <p className="muted negative num">
          Écart de {formatCents(drift)} — un transfert ne crée pas d'argent, il en déplace.
        </p>
      ) : touched ? (
        <p className="muted positive">Total conservé.</p>
      ) : (
        <p className="muted">
          Mets un poste important à zéro : ce qu'il devait passera sur les postes suivants.
        </p>
      )}

      <div className="row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={save}
          disabled={drift !== 0 || anyInvalid || !touched}
        >
          Enregistrer
        </button>
        <button type="button" className="btn btn--sm" onClick={propose}>
          Proposer
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => setEdits(null)}
          disabled={!touched}
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

function ApportSection({ dataset, month }: { dataset: Dataset; month: MonthKey }) {
  const { notifyError } = useData();
  const pots = useMemo(() => oneOffIncomesIn(dataset, month), [dataset, month]);
  const [incomeId, setIncomeId] = useState<string>("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const pot = pots.find((p) => p.id === incomeId) ?? pots[0];

  const shortfalls = useMemo(
    () =>
      categoriesActiveIn(dataset, month)
        .map((category) => {
          const state = monthStateFor(dataset, category.id, month);
          return {
            category,
            categoryId: category.id,
            shortfallCents: state && state.remainingCents < 0 ? -state.remainingCents : 0,
          };
        })
        .filter((s) => s.shortfallCents > 0)
        .toSorted((a, b) => b.shortfallCents - a.shortfallCents),
    [dataset, month],
  );

  if (pots.length === 0) {
    return (
      <div className="card">
        <div className="card__head">
          <h3>Placer un apport</h3>
        </div>
        <p className="muted">
          Aucun revenu ponctuel sur {formatMonth(month)}. Ajoute-le dans les{" "}
          <strong>Réglages</strong> en cochant « Ponctuel ».
        </p>
      </div>
    );
  }

  const prefill = () => {
    if (!pot) return;
    const parts = spreadOverShortfalls(shortfalls, pot.amountCents);
    setAmounts(Object.fromEntries(parts.map((p) => [p.categoryId, centsToInput(p.amountCents)])));
  };

  const placedCents = shortfalls.reduce(
    (s, r) =>
      s + (isValidAmount(amounts[r.categoryId] ?? "") ? eurosToCents(amounts[r.categoryId]) : 0),
    0,
  );
  const leftCents = (pot?.amountCents ?? 0) - placedCents;
  const overspent = leftCents < 0;
  const anyInvalid = Object.values(amounts).some((v) => v !== "" && !isValidAmount(v));

  const save = () => {
    if (!pot || overspent || anyInvalid || placedCents <= 0) return;
    const inputs = shortfalls
      .map((r) => ({
        month,
        fromCategoryId: null,
        toCategoryId: r.categoryId,
        fromIncomeId: pot.id,
        amountCents: isValidAmount(amounts[r.categoryId] ?? "")
          ? eurosToCents(amounts[r.categoryId])
          : 0,
        label: pot.name,
      }))
      .filter((i) => i.amountCents > 0);
    replaceBudgetMovements(month, "apport", inputs).catch((err: unknown) =>
      notifyError(syncErrorMessage("apport", err)),
    );
    setAmounts({});
  };

  return (
    <div className="card">
      <div className="card__head">
        <h3>Placer un apport</h3>
        <span className="card__head-total num positive">{formatCents(pot?.amountCents ?? 0)}</span>
      </div>

      {pots.length > 1 && (
        <div className="field">
          <span className="field__label">Revenu ponctuel</span>
          <select
            className="input"
            value={pot?.id ?? ""}
            onChange={(e) => setIncomeId(e.target.value)}
            aria-label="Revenu ponctuel"
          >
            {pots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatCents(p.amountCents)}
              </option>
            ))}
          </select>
        </div>
      )}

      {shortfalls.length === 0 ? (
        <p className="muted">Aucun poste en négatif sur {formatMonth(month)}.</p>
      ) : (
        <>
          {shortfalls.map((r) => (
            <div className="mv-row" key={r.categoryId}>
              <span className="poste__name">
                <span
                  className="poste__dot"
                  style={{ background: posteColor(r.category) }}
                  aria-hidden
                />
                <strong>{r.category.name}</strong>
              </span>
              <span className="mv-row__from muted num">manque {formatCents(r.shortfallCents)}</span>
              <input
                className="input mv-row__field"
                inputMode="decimal"
                value={amounts[r.categoryId] ?? ""}
                placeholder="0,00"
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [r.categoryId]: e.target.value }))
                }
                aria-label={`Apport sur ${r.category.name}`}
              />
            </div>
          ))}

          <p className={`muted num ${overspent ? "negative" : ""}`}>
            {overspent
              ? `${formatCents(-leftCents)} de trop — l'apport ne fait que ${formatCents(pot?.amountCents ?? 0)}.`
              : `Reste à placer : ${formatCents(leftCents)}`}
          </p>

          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={save}
              disabled={overspent || anyInvalid || placedCents <= 0}
            >
              Enregistrer
            </button>
            <button type="button" className="btn btn--sm" onClick={prefill}>
              Répartir au prorata
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setAmounts({})}
              disabled={placedCents === 0}
            >
              Vider
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The month's movements, in the open. This is the trace the carry override never
 * left: the overdraft and the gesture that patched it both stay readable, so
 * months later it is still possible to tell "I covered this" from "I ignored it".
 */
function MovementsSection({ dataset, month }: { dataset: Dataset; month: MonthKey }) {
  const { notifyError } = useData();
  const movements = useMemo(() => movementsIn(dataset, month), [dataset, month]);
  const nameOf = (id: string | null) =>
    dataset.categories.find((c) => c.id === id)?.name ?? "poste supprimé";

  if (movements.length === 0) return null;

  return (
    <div className="card">
      <div className="card__head">
        <h3>Mouvements de {formatMonth(month)}</h3>
        <span className="card__head-total num">{movements.length}</span>
      </div>
      {movements.map((m) => (
        <div className="list-item" key={m.id}>
          <div>
            <div>
              {m.fromCategoryId === null ? (
                <>
                  <strong className="positive">Apport</strong> vers {nameOf(m.toCategoryId)}
                </>
              ) : (
                <>
                  {nameOf(m.fromCategoryId)} → <strong>{nameOf(m.toCategoryId)}</strong>
                </>
              )}
            </div>
            {m.label && <div className="muted">{m.label}</div>}
          </div>
          <div className="list-item__actions">
            <span className="num">{formatCents(m.amountCents)}</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() =>
                softDeleteBudgetMovement(m.id).catch((err: unknown) =>
                  notifyError(syncErrorMessage("mouvement", err)),
                )
              }
            >
              Annuler
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
