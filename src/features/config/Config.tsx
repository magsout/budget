import { type FormEvent, useId, useState } from "react";
import { ColorSwatchPicker } from "../../components/ColorSwatchPicker.tsx";
import { useData } from "../../data/DataContext.tsx";
import {
  addCategory,
  addIncome,
  addRecurringExpense,
  addUser,
  changeCategoryBudget,
  clearCarryOverride,
  type NewCashflowInput,
  reorderCategories,
  restoreExpense,
  setCarryOverride,
  setCategoryArchived,
  setUserArchived,
  softDeleteIncome,
  softDeleteRecurringExpense,
  updateCategory,
  updateIncome,
  updateRecurringExpense,
  updateUser,
} from "../../data/firestore.ts";
import {
  budgetVersionFor,
  carryOverrideFor,
  categoriesActiveIn,
  deletedExpenses,
  monthStateFor,
} from "../../lib/budget.ts";
import { avatarColorFor, DEFAULT_CATEGORY_COLOR } from "../../lib/colors.ts";
import { currentMonth, formatDate, formatMonth, prevMonth } from "../../lib/dates.ts";
import { carryLabel } from "../../lib/labels.ts";
import {
  centsToInput,
  eurosToCents,
  isValidAmount,
  isValidPositiveAmount,
} from "../../lib/money.ts";
import { formatCents } from "../../lib/money.ts";
import { moveInList } from "../../lib/order.ts";
import type { Category, Dataset, Income, RecurringExpense, User } from "../../lib/types.ts";
import { activeUsers } from "../../lib/users.ts";

/** Route a terminal write failure to the shared error banner. Offline writes never
 * reject here — Firestore queues them — so this fires only on genuine errors. */
function syncErrorMessage(context: string, err: unknown): string {
  return `Échec de synchronisation (${context}) : ${err instanceof Error ? err.message : String(err)}`;
}

export function Config({ dataset }: { dataset: Dataset }) {
  return (
    <div>
      <CategoriesSection dataset={dataset} />
      <CarryResetSection dataset={dataset} />
      <CashflowSection
        title="Dépenses mensuelles"
        errorContext="dépense mensuelle"
        namePlaceholder="Ex : Loyer"
        amountPlaceholder="1200"
        items={dataset.recurringExpenses}
        add={addRecurringExpense}
        update={updateRecurringExpense}
        softDelete={softDeleteRecurringExpense}
      />
      <CashflowSection
        title="Revenus"
        errorContext="revenu"
        namePlaceholder="Ex : Salaire"
        amountPlaceholder="2500"
        items={dataset.incomes}
        add={addIncome}
        update={updateIncome}
        softDelete={softDeleteIncome}
      />
      <UsersSection dataset={dataset} />
      <TrashSection dataset={dataset} />
      <p className="muted" style={{ textAlign: "center", marginTop: 8 }}>
        Modifier un montant s'applique à partir du mois courant ({formatMonth(currentMonth())}) ;
        les mois passés gardent leur valeur.
      </p>
    </div>
  );
}

/* ---- categories --------------------------------------------------------- */

function CategoriesSection({ dataset }: { dataset: Dataset }) {
  const { notifyError } = useData();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);

  const active = dataset.categories
    .filter((c) => !c.archivedAt)
    .toSorted((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const canAdd = name.trim().length > 0 && isValidPositiveAmount(amount);

  // Reordering lives here rather than in the row: only this level knows the
  // full order, and the whole list is renumbered in one batch.
  const move = (index: number, delta: number) => {
    const reordered = moveInList(active, index, delta);
    if (reordered === active) return;
    reorderCategories(reordered.map((c) => c.id)).catch((err: unknown) =>
      notifyError(syncErrorMessage("ordre des postes", err)),
    );
  };

  // Optimistic: queue the write and reset the form immediately; the listener
  // re-renders the new poste from the local cache and syncs in the background.
  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    addCategory({ name, amountCents: eurosToCents(amount), color }).catch((err: unknown) =>
      notifyError(syncErrorMessage("poste", err)),
    );
    setName("");
    setAmount("");
    setColor(DEFAULT_CATEGORY_COLOR);
  };

  return (
    <div className="card">
      <h3>Postes de dépenses</h3>
      {active.length === 0 && <p className="muted">Aucun poste pour l'instant.</p>}
      {active.map((c, i) => (
        <CategoryRow
          key={c.id}
          category={c}
          dataset={dataset}
          onMove={active.length > 1 ? (delta) => move(i, delta) : undefined}
          isFirst={i === 0}
          isLast={i === active.length - 1}
        />
      ))}

      <ArchivedCategories dataset={dataset} />

      <form onSubmit={onAdd} style={{ marginTop: 12 }}>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label className="field__label" htmlFor="cat-name">
              Nouveau poste
            </label>
            <input
              id="cat-name"
              className="input"
              placeholder="Ex : Courses"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="cat-amount">
              Montant (€)
            </label>
            <input
              id="cat-amount"
              className="input"
              inputMode="decimal"
              placeholder="650"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <span className="field__label">Couleur</span>
          <ColorSwatchPicker value={color} onChange={setColor} label="Couleur du poste" />
        </div>
        <button type="submit" className="btn btn--primary btn--block" disabled={!canAdd}>
          Ajouter le poste
        </button>
      </form>
    </div>
  );
}

function CategoryRow({
  category,
  dataset,
  onMove,
  isFirst,
  isLast,
}: {
  category: Category;
  dataset: Dataset;
  /** Undefined when there is nothing to reorder (a single poste). */
  onMove?: (delta: number) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { notifyError } = useData();
  const month = currentMonth();
  const currentAmount = budgetVersionFor(dataset.budgetVersions, category.id, month);

  // The report the fold would produce on its own (last month's remaining), and
  // the hand-set one if any. `autoCarry` is what "rétablir le calcul" restores.
  const autoCarryCents = monthStateFor(dataset, category.id, prevMonth(month))?.remainingCents ?? 0;
  const override = carryOverrideFor(dataset.carryOverrides, category.id, month);
  const effectiveCarryCents = override ?? autoCarryCents;
  const carryNote = carryLabel({
    carryInCents: effectiveCarryCents,
    carryAdjusted: override !== null,
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [amount, setAmount] = useState(centsToInput(currentAmount));
  const [color, setColor] = useState(category.color ?? DEFAULT_CATEGORY_COLOR);
  const [carry, setCarry] = useState(centsToInput(effectiveCarryCents));

  const carryValid = isValidAmount(carry);

  // Optimistic: queue the writes and close the editor immediately.
  const save = () => {
    if (!isValidPositiveAmount(amount) || name.trim().length === 0 || !carryValid) return;
    const patch: { name?: string; color?: string } = {};
    if (name.trim() !== category.name) patch.name = name.trim();
    if (color !== (category.color ?? null)) patch.color = color;
    const ops: Promise<void>[] = [];
    if (Object.keys(patch).length > 0) ops.push(updateCategory(category.id, patch));
    const cents = eurosToCents(amount);
    if (cents !== currentAmount) ops.push(changeCategoryBudget(category.id, cents, month));

    // Typing the computed value back means "stop overriding", so drop the doc
    // rather than freeze a value that would then stop tracking the ledger.
    const carryCents = eurosToCents(carry);
    if (carryCents === autoCarryCents) {
      if (override !== null) ops.push(clearCarryOverride(category.id, month));
    } else if (carryCents !== override) {
      ops.push(setCarryOverride(category.id, month, carryCents));
    }

    Promise.all(ops).catch((err: unknown) => notifyError(syncErrorMessage("poste", err)));
    setEditing(false);
  };

  const archive = () => {
    if (
      confirm(`Archiver le poste « ${category.name} » ? Il n'apparaîtra plus à partir de ce mois.`)
    ) {
      setCategoryArchived(category.id, true).catch((err: unknown) =>
        notifyError(syncErrorMessage("archivage", err)),
      );
    }
  };

  if (editing) {
    return (
      <div className="list-item" style={{ flexWrap: "wrap" }}>
        <div className="row" style={{ width: "100%" }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nom"
          />
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Montant"
          />
        </div>
        <div style={{ width: "100%", marginTop: 8 }}>
          <ColorSwatchPicker value={color} onChange={setColor} label="Couleur du poste" />
        </div>
        <div className="field" style={{ width: "100%", marginTop: 8 }}>
          <span className="field__label">Report de {formatMonth(prevMonth(month))}</span>
          <div className="row">
            <input
              className="input"
              inputMode="text"
              value={carry}
              onChange={(e) => setCarry(e.target.value)}
              aria-label="Report"
            />
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setCarry(centsToInput(0))}
              disabled={eurosToCents(carry) === 0}
            >
              Remettre à zéro
            </button>
          </div>
          {!carryValid ? (
            <p className="muted negative">Montant invalide (un report peut être négatif).</p>
          ) : override !== null ? (
            <p className="muted">
              Report ajusté à la main.{" "}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setCarry(centsToInput(autoCarryCents))}
              >
                Rétablir le calcul ({formatCents(autoCarryCents)})
              </button>
            </p>
          ) : (
            <p className="muted">
              À zéro, le mois repart du montant initial sans le reste du mois précédent.
            </p>
          )}
        </div>
        <div className="row" style={{ width: "100%", marginTop: 8 }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={save}
            disabled={!carryValid}
          >
            Enregistrer
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>
            Annuler
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={archive}>
            Archiver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="list-item">
      <div>
        <div className="poste__name">
          <span
            className="poste__dot"
            style={category.color ? { background: category.color } : undefined}
          />
          <strong>{category.name}</strong>
        </div>
        <div className="muted">
          {formatCents(currentAmount)} / mois
          {carryNote ? ` · ${carryNote}` : ""}
        </div>
      </div>
      <div className="list-item__actions">
        {onMove && (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={() => onMove(-1)}
              disabled={isFirst}
              aria-label={`Monter ${category.name}`}
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={() => onMove(1)}
              disabled={isLast}
              aria-label={`Descendre ${category.name}`}
            >
              ↓
            </button>
          </>
        )}
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
          Modifier
        </button>
      </div>
    </div>
  );
}

/**
 * Archived postes, hidden behind a disclosure. Archiving is reversible in the
 * data model (`archivedAt` back to null) but was unreachable from the UI.
 */
function ArchivedCategories({ dataset }: { dataset: Dataset }) {
  const [open, setOpen] = useState(false);

  const archived = dataset.categories
    .filter((c) => c.archivedAt)
    .toSorted((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));

  if (archived.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "▾" : "▸"} Postes archivés ({archived.length})
      </button>
      {open &&
        archived.map((c) => <ArchivedCategoryRow key={c.id} category={c} dataset={dataset} />)}
    </div>
  );
}

function ArchivedCategoryRow({ category, dataset }: { category: Category; dataset: Dataset }) {
  const { notifyError } = useData();
  const month = currentMonth();
  const [confirming, setConfirming] = useState(false);

  // What the fold would hand back on reactivation: the poste keeps its whole
  // history, so an old balance (or overdraft) comes back with it.
  const returningCarryCents = monthStateFor(dataset, category.id, month)?.carryInCents ?? 0;

  const reactivate = (resetCarry: boolean) => {
    const ops = [setCategoryArchived(category.id, false)];
    if (resetCarry) ops.push(setCarryOverride(category.id, month, 0));
    Promise.all(ops).catch((err: unknown) => notifyError(syncErrorMessage("réactivation", err)));
    setConfirming(false);
  };

  return (
    <div className="list-item" style={{ flexWrap: "wrap" }}>
      <div>
        <div className="poste__name">
          <span
            className="poste__dot"
            style={category.color ? { background: category.color } : undefined}
          />
          <strong>{category.name}</strong>
        </div>
        <div className="muted">
          Archivé{category.archivedAt ? ` le ${formatDate(category.archivedAt.slice(0, 10))}` : ""}
        </div>
      </div>
      {confirming ? (
        <>
          <p className="muted" style={{ width: "100%", marginTop: 8 }}>
            {returningCarryCents === 0
              ? "Ce poste repart sans report."
              : `Son report de ${formatCents(returningCarryCents)} revient avec lui.`}
          </p>
          <div className="row" style={{ width: "100%", marginTop: 8 }}>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => reactivate(false)}
            >
              Réactiver
            </button>
            {returningCarryCents !== 0 && (
              <button type="button" className="btn btn--sm" onClick={() => reactivate(true)}>
                Réactiver à zéro
              </button>
            )}
            <button type="button" className="btn btn--sm" onClick={() => setConfirming(false)}>
              Annuler
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setConfirming(true)}
        >
          Réactiver
        </button>
      )}
    </div>
  );
}

/* ---- carry reset (all postes at once) ----------------------------------- */

/**
 * Month-wide reset: force every active poste's report to zero so the current
 * month restarts from its initial amounts. Past months are untouched (the
 * override only applies to this month) and next month carries over as usual.
 */
function CarryResetSection({ dataset }: { dataset: Dataset }) {
  const { notifyError } = useData();
  const month = currentMonth();

  // Same set the dashboard shows for the month, so the counts always match.
  const active = categoriesActiveIn(dataset, month);
  const carried = active.filter(
    (c) => (monthStateFor(dataset, c.id, month)?.carryInCents ?? 0) !== 0,
  );
  const adjusted = active.filter(
    (c) => carryOverrideFor(dataset.carryOverrides, c.id, month) !== null,
  );

  const run = (ops: Promise<void>[]) => {
    Promise.all(ops).catch((err: unknown) => notifyError(syncErrorMessage("report", err)));
  };

  const resetAll = () => {
    if (
      !confirm(
        `Ignorer le report de ${carried.length} poste(s) pour ${formatMonth(month)} ? Chacun repart de son montant initial.`,
      )
    ) {
      return;
    }
    run(carried.map((c) => setCarryOverride(c.id, month, 0)));
  };

  const restoreAll = () => {
    run(adjusted.map((c) => clearCarryOverride(c.id, month)));
  };

  return (
    <div className="card">
      <h3>Reports</h3>
      <p className="muted">
        Chaque poste reporte son solde d'un mois sur l'autre. Remets les reports à zéro pour que{" "}
        {formatMonth(month)} reparte des montants initiaux, sans le reste du mois précédent.
      </p>
      <button
        type="button"
        className="btn btn--block"
        onClick={resetAll}
        disabled={carried.length === 0}
      >
        {carried.length === 0
          ? "Aucun report à ignorer ce mois-ci"
          : `Ignorer les reports de ${formatMonth(month)}`}
      </button>
      {adjusted.length > 0 && (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 8 }}
          onClick={restoreAll}
        >
          Rétablir les reports calculés ({adjusted.length})
        </button>
      )}
    </div>
  );
}

/* ---- cashflow: recurring expenses & incomes ----------------------------- */

type CashflowItem = RecurringExpense | Income;

interface CashflowSectionProps {
  title: string;
  errorContext: string;
  namePlaceholder: string;
  amountPlaceholder: string;
  items: CashflowItem[];
  add: (input: NewCashflowInput) => Promise<void>;
  update: (id: string, input: NewCashflowInput) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

/** Manage a recurring-monthly list (expenses OR incomes — identical shapes). */
function CashflowSection({
  title,
  errorContext,
  namePlaceholder,
  amountPlaceholder,
  items,
  add,
  update,
  softDelete,
}: CashflowSectionProps) {
  const { notifyError } = useData();
  const uid = useId();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");

  const list = items
    .filter((it) => !it.deletedAt)
    .toSorted((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name));

  const rangeInvalid = startMonth !== "" && endMonth !== "" && startMonth > endMonth;
  const canAdd = name.trim().length > 0 && isValidPositiveAmount(amount) && !rangeInvalid;

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    add({
      name,
      amountCents: eurosToCents(amount),
      description: description || null,
      startMonth: startMonth || null,
      endMonth: endMonth || null,
    }).catch((err: unknown) => notifyError(syncErrorMessage(errorContext, err)));
    setName("");
    setAmount("");
    setDescription("");
    setStartMonth("");
    setEndMonth("");
  };

  return (
    <div className="card">
      <h3>{title}</h3>
      {list.length === 0 && <p className="muted">Rien pour l'instant.</p>}
      {list.map((it) => (
        <CashflowRow
          key={it.id}
          item={it}
          errorContext={errorContext}
          update={update}
          softDelete={softDelete}
        />
      ))}

      <form onSubmit={onAdd} style={{ marginTop: 12 }}>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label className="field__label" htmlFor={`${uid}-name`}>
              Nom
            </label>
            <input
              id={`${uid}-name`}
              className="input"
              placeholder={namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-amount`}>
              Montant (€)
            </label>
            <input
              id={`${uid}-amount`}
              className="input"
              inputMode="decimal"
              placeholder={amountPlaceholder}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${uid}-desc`}>
            Description (optionnel)
          </label>
          <input
            id={`${uid}-desc`}
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="row">
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-start`}>
              Début (optionnel)
            </label>
            <input
              id={`${uid}-start`}
              type="month"
              className="input"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-end`}>
              Fin (optionnel)
            </label>
            <input
              id={`${uid}-end`}
              type="month"
              className="input"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
            />
          </div>
        </div>
        {rangeInvalid && <p className="muted negative">La fin doit être après le début.</p>}
        <button type="submit" className="btn btn--primary btn--block" disabled={!canAdd}>
          Ajouter
        </button>
      </form>
    </div>
  );
}

function CashflowRow({
  item,
  errorContext,
  update,
  softDelete,
}: {
  item: CashflowItem;
  errorContext: string;
  update: (id: string, input: NewCashflowInput) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}) {
  const { notifyError } = useData();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(centsToInput(item.amountCents));
  const [description, setDescription] = useState(item.description ?? "");
  const [startMonth, setStartMonth] = useState(item.startMonth ?? "");
  const [endMonth, setEndMonth] = useState(item.endMonth ?? "");

  const rangeInvalid = startMonth !== "" && endMonth !== "" && startMonth > endMonth;
  const canSave = name.trim().length > 0 && isValidPositiveAmount(amount) && !rangeInvalid;

  const save = () => {
    if (!canSave) return;
    update(item.id, {
      name,
      amountCents: eurosToCents(amount),
      description: description || null,
      startMonth: startMonth || null,
      endMonth: endMonth || null,
    }).catch((err: unknown) => notifyError(syncErrorMessage(errorContext, err)));
    setEditing(false);
  };

  const remove = () => {
    if (!confirm(`Supprimer « ${item.name} » ?`)) return;
    softDelete(item.id).catch((err: unknown) => notifyError(syncErrorMessage("suppression", err)));
  };

  if (editing) {
    return (
      <div className="list-item" style={{ flexWrap: "wrap" }}>
        <div className="row" style={{ width: "100%" }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nom"
          />
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Montant"
          />
        </div>
        <div style={{ width: "100%", marginTop: 8 }}>
          <input
            className="input"
            placeholder="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="Description"
          />
        </div>
        <div className="row" style={{ width: "100%", marginTop: 8 }}>
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-start`}>
              Début
            </label>
            <input
              id={`${uid}-start`}
              type="month"
              className="input"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-end`}>
              Fin
            </label>
            <input
              id={`${uid}-end`}
              type="month"
              className="input"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
            />
          </div>
        </div>
        {rangeInvalid && (
          <p className="muted negative" style={{ width: "100%" }}>
            La fin doit être après le début.
          </p>
        )}
        <div className="row" style={{ width: "100%", marginTop: 8 }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={save}
            disabled={!canSave}
          >
            Enregistrer
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>
            Annuler
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={remove}>
            Supprimer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="list-item">
      <div>
        <strong>{item.name}</strong>
        <div className="muted">
          {formatCents(item.amountCents)} / mois
          {item.startMonth || item.endMonth
            ? ` · ${item.startMonth ? formatMonth(item.startMonth) : "…"} → ${
                item.endMonth ? formatMonth(item.endMonth) : "…"
              }`
            : ""}
        </div>
      </div>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
        Modifier
      </button>
    </div>
  );
}

/* ---- trash -------------------------------------------------------------- */

/**
 * Deleted expenses, restorable. Deletion has always been a soft delete
 * (`deletedAt`), so the rows were still there — just unreachable. Hidden
 * entirely when empty rather than showing an empty card.
 */
function TrashSection({ dataset }: { dataset: Dataset }) {
  const { notifyError } = useData();
  const deleted = deletedExpenses(dataset);

  if (deleted.length === 0) return null;

  const categoryName = (id: string) => dataset.categories.find((c) => c.id === id)?.name ?? "—";
  const userName = (id: string) => dataset.users.find((u) => u.id === id)?.firstName ?? "—";

  const restore = (id: string) => {
    restoreExpense(id).catch((err: unknown) => notifyError(syncErrorMessage("restauration", err)));
  };

  return (
    <div className="card">
      <h3>Corbeille</h3>
      <p className="muted">
        Dépenses supprimées. Les restaurer les remet dans le mois de leur date et recalcule les
        soldes.
      </p>
      {deleted.map((e) => (
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
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => restore(e.id)}>
            Restaurer
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---- users -------------------------------------------------------------- */

function UsersSection({ dataset }: { dataset: Dataset }) {
  const { notifyError } = useData();
  const [firstName, setFirstName] = useState("");

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (firstName.trim().length === 0) return;
    addUser(firstName).catch((err: unknown) => notifyError(syncErrorMessage("utilisateur", err)));
    setFirstName("");
  };

  const active = activeUsers(dataset.users);
  const archived = dataset.users.filter((u) => u.archivedAt);

  return (
    <div className="card">
      <h3>Utilisateurs</h3>
      {active.length === 0 && <p className="muted">Aucun utilisateur.</p>}
      {active.map((u) => (
        // Retiring the last person would lock the expense form out entirely.
        <UserRow key={u.id} user={u} canArchive={active.length > 1} />
      ))}
      {archived.map((u) => (
        <ArchivedUserRow key={u.id} user={u} />
      ))}
      <form onSubmit={onAdd} className="row" style={{ marginTop: 12 }}>
        <input
          className="input"
          placeholder="Prénom"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          aria-label="Prénom"
        />
        <button type="submit" className="btn btn--primary" disabled={firstName.trim().length === 0}>
          Ajouter
        </button>
      </form>
    </div>
  );
}

function UserRow({ user, canArchive }: { user: User; canArchive: boolean }) {
  const { notifyError } = useData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.firstName);

  const fail = (context: string) => (err: unknown) => notifyError(syncErrorMessage(context, err));

  const save = () => {
    if (name.trim().length === 0) return;
    if (name.trim() !== user.firstName) updateUser(user.id, name).catch(fail("utilisateur"));
    setEditing(false);
  };

  const archive = () => {
    if (!confirm(`Retirer « ${user.firstName} » ? Ses dépenses passées gardent son nom.`)) return;
    setUserArchived(user.id, true).catch(fail("utilisateur"));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="list-item" style={{ flexWrap: "wrap" }}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Prénom"
        />
        <div className="row" style={{ width: "100%", marginTop: 8 }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={save}
            disabled={name.trim().length === 0}
          >
            Enregistrer
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>
            Annuler
          </button>
          {canArchive && (
            <button type="button" className="btn btn--sm btn--danger" onClick={archive}>
              Retirer
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="list-item">
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
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
        Modifier
      </button>
    </div>
  );
}

function ArchivedUserRow({ user }: { user: User }) {
  const { notifyError } = useData();
  return (
    <div className="list-item">
      <div>
        <span>{user.firstName}</span>
        <div className="muted">Retiré</div>
      </div>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={() =>
          setUserArchived(user.id, false).catch((err: unknown) =>
            notifyError(syncErrorMessage("utilisateur", err)),
          )
        }
      >
        Réactiver
      </button>
    </div>
  );
}
