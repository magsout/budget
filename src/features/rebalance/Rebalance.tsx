import { type ReactNode, useMemo, useState } from "react";
import { MonthNav } from "../../components/MonthNav.tsx";
import { useData } from "../../data/DataContext.tsx";
import { softDeleteBudgetMovement, writeBudgetMovements } from "../../data/firestore.ts";
import { oneOffIncomesIn } from "../../lib/account.ts";
import { type CategorySummary, monthSummary } from "../../lib/budget.ts";
import { posteColor } from "../../lib/colors.ts";
import { formatMonth, type MonthKey } from "../../lib/dates.ts";
import {
  centsToInput,
  eurosToCents,
  formatCents,
  isValidAmount,
  isValidPositiveAmount,
} from "../../lib/money.ts";
import {
  apportsToReplace,
  movementsIn,
  proposeRepartition,
  repartitionDrift,
  repartitionToMovements,
  spreadOverShortfalls,
  transfersToReplace,
} from "../../lib/movements.ts";
import { syncErrorMessage } from "../../lib/sync.ts";
import type { Category, Dataset } from "../../lib/types.ts";

/**
 * Where a month's reports get redistributed and a one-off income gets placed.
 *
 * A sub-page rather than a tab, like Réglages: it owns a « ‹ Retour » and no tab
 * could legitimately read as active here. It carries its own month stepper —
 * unbounded, so September's reports can be sorted out in August, before the month
 * that inherits them begins. That is the whole reason this is not a section of the
 * Dashboard, which is pinned to the current month.
 *
 * `initialMonth` comes from whoever opened the screen, so the Dashboard's nudge
 * can name a month in its label and be sure this lands on it.
 */
export function Rebalance({ dataset, initialMonth }: { dataset: Dataset; initialMonth: MonthKey }) {
  const [month, setMonth] = useState<MonthKey>(initialMonth);

  // One fold for the whole screen. Both sections read the same rows — the reports
  // to redistribute and the deficits to fill are two fields of one MonthState —
  // and `monthSummary` is also what DEFINES the priority order the proposal uses,
  // so taking it from anywhere else would let the two drift apart.
  const summary = useMemo(() => monthSummary(dataset, month), [dataset, month]);

  return (
    <div>
      <div className="card">
        <MonthNav month={month} onChange={setMonth} className="month-nav--inline" />
        <p className="muted">
          Le report de chaque poste peut être déplacé vers un autre : le total ne change pas, tu
          choisis seulement qui le porte.
        </p>
      </div>
      {/* Keyed by month so stepping the stepper abandons a half-made draft instead
          of carrying figures onto a month they were not typed for. A `key` does
          that for free; tracking it inside the state was the same thing by hand,
          and it only ever covered one of the two sections. */}
      <RepartitionSection key={`r-${month}`} dataset={dataset} month={month} summary={summary} />
      <ApportSection key={`a-${month}`} dataset={dataset} month={month} summary={summary} />
      <MovementsSection dataset={dataset} month={month} />
    </div>
  );
}

interface SectionProps {
  dataset: Dataset;
  month: MonthKey;
  summary: CategorySummary[];
}

/**
 * A row of either section: poste, the figure it starts from, the field that
 * changes it. Shared because both rows have to match one CSS contract (the
 * three-track grid, the `.poste__name` shrink override, the 360px collapse), and
 * two copies of that markup drift from it independently.
 */
function MvRow({
  category,
  hint,
  value,
  onChange,
  ariaLabel,
  inputMode,
  placeholder,
}: {
  category: Category;
  hint: ReactNode;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  inputMode: "text" | "decimal";
  placeholder?: string;
}) {
  return (
    <div className="mv-row">
      <span className="poste__name">
        <span className="poste__dot" style={{ background: posteColor(category) }} aria-hidden />
        <strong>{category.name}</strong>
      </span>
      <span className="mv-row__from muted num">{hint}</span>
      <input
        className="input mv-row__field"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
    </div>
  );
}

function RepartitionSection({ dataset, month, summary }: SectionProps) {
  const { notifyError } = useData();

  // The only thing the user owns is one string per poste. Everything else — the
  // computed report, the parsed value — is derived, so there is no pair of fields
  // to keep in sync, and a fresh snapshot mid-edit updates the reports the draft
  // is measured against instead of being silently discarded.
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const rows = summary.map(({ category, state }) => {
    const carryInCents = state.carryInCents;
    const input = inputs[category.id] ?? centsToInput(carryInCents);
    return {
      category,
      categoryId: category.id,
      carryInCents,
      adjustedCents: isValidAmount(input) ? eurosToCents(input) : carryInCents,
      input,
    };
  });

  const drift = repartitionDrift(rows);
  const anyInvalid = rows.some((r) => !isValidAmount(r.input));
  const changed = rows.some((r) => r.adjustedCents !== r.carryInCents);
  // Separate from `changed`: a field holding garbage has nothing to save but is
  // very much something to reset.
  const edited = Object.keys(inputs).length > 0;
  const totalCents = rows.reduce((s, r) => s + r.carryInCents, 0);

  const save = () => {
    if (drift !== 0 || anyInvalid || !changed) return;
    writeBudgetMovements(
      repartitionToMovements(rows, month),
      transfersToReplace(dataset, month),
    ).catch((err: unknown) => notifyError(syncErrorMessage("répartition du report", err)));
    setInputs({});
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
        <MvRow
          key={r.categoryId}
          category={r.category}
          /* The computed report stays next to the field: the point of the gesture
             is seeing what you are moving away from. */
          hint={`${formatCents(r.carryInCents)} →`}
          value={r.input}
          onChange={(v) => setInputs((prev) => ({ ...prev, [r.categoryId]: v }))}
          ariaLabel={`Report ajusté de ${r.category.name}`}
          inputMode="text"
        />
      ))}

      {anyInvalid ? (
        <p className="muted negative">Montant invalide (un report peut être négatif).</p>
      ) : drift !== 0 ? (
        <p className="muted negative num">
          Écart de {formatCents(drift)} — un transfert ne crée pas d'argent, il en déplace.
        </p>
      ) : changed ? (
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
          disabled={drift !== 0 || anyInvalid || !changed}
        >
          Enregistrer
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() =>
            setInputs(
              Object.fromEntries(
                proposeRepartition(rows).map((r) => [r.categoryId, centsToInput(r.adjustedCents)]),
              ),
            )
          }
        >
          Proposer
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => setInputs({})}
          disabled={!edited}
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}

function ApportSection({ dataset, month, summary }: SectionProps) {
  const { notifyError } = useData();
  const pots = useMemo(() => oneOffIncomesIn(dataset, month), [dataset, month]);
  const [incomeId, setIncomeId] = useState<string>("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const pot = pots.find((p) => p.id === incomeId) ?? pots[0];

  const shortfalls = summary
    .filter((s) => s.state.remainingCents < 0)
    .map(({ category, state }) => ({ category, shortfallCents: -state.remainingCents }))
    .toSorted((a, b) => b.shortfallCents - a.shortfallCents);

  // Derived from the CURRENT rows, so a figure typed against a month or a poste
  // that is no longer listed cannot keep the button disabled with no field to fix.
  const placed = shortfalls.map((r) => {
    const raw = amounts[r.category.id] ?? "";
    return {
      ...r,
      raw,
      // An apport adds money, so a negative is not a valid entry here — unlike a
      // report, which legitimately can be.
      valid: raw === "" || isValidPositiveAmount(raw),
      cents: isValidPositiveAmount(raw) ? eurosToCents(raw) : 0,
    };
  });

  const placedCents = placed.reduce((s, r) => s + r.cents, 0);
  const leftCents = (pot?.amountCents ?? 0) - placedCents;
  const overspent = leftCents < 0;
  const anyInvalid = placed.some((r) => !r.valid);

  const save = () => {
    if (!pot || overspent || anyInvalid || placedCents <= 0) return;
    writeBudgetMovements(
      placed
        .filter((r) => r.cents > 0)
        .map((r) => ({
          month,
          fromCategoryId: null,
          toCategoryId: r.category.id,
          fromIncomeId: pot.id,
          amountCents: r.cents,
          label: pot.name,
        })),
      // This pot's apports only — see `apportsToReplace`.
      apportsToReplace(dataset, month, pot.id),
    ).catch((err: unknown) => notifyError(syncErrorMessage("apport", err)));
    setAmounts({});
  };

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

      {placed.length === 0 ? (
        <p className="muted">Aucun poste en négatif sur {formatMonth(month)}.</p>
      ) : (
        <>
          {placed.map((r) => (
            <MvRow
              key={r.category.id}
              category={r.category}
              hint={`manque ${formatCents(r.shortfallCents)}`}
              value={r.raw}
              onChange={(v) => setAmounts((prev) => ({ ...prev, [r.category.id]: v }))}
              ariaLabel={`Apport sur ${r.category.name}`}
              inputMode="decimal"
              placeholder="0,00"
            />
          ))}

          <p className={`muted num ${overspent || anyInvalid ? "negative" : ""}`}>
            {anyInvalid
              ? "Montant invalide (un apport ajoute de l'argent, il ne peut pas être négatif)."
              : overspent
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
            <button
              type="button"
              className="btn btn--sm"
              onClick={() =>
                setAmounts(
                  Object.fromEntries(
                    spreadOverShortfalls(
                      shortfalls.map((r) => ({
                        categoryId: r.category.id,
                        shortfallCents: r.shortfallCents,
                      })),
                      pot?.amountCents ?? 0,
                    ).map((p) => [p.categoryId, centsToInput(p.amountCents)]),
                  ),
                )
              }
            >
              Répartir au prorata
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setAmounts({})}
              disabled={Object.keys(amounts).length === 0}
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
  const names = useMemo(
    () => new Map(dataset.categories.map((c) => [c.id, c.name])),
    [dataset.categories],
  );
  const nameOf = (id: string | null) => (id && names.get(id)) || "poste supprimé";

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
