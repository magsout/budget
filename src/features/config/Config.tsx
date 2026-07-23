import { type FormEvent, useState } from "react";
import { ColorSwatchPicker } from "../../components/ColorSwatchPicker.tsx";
import { useData } from "../../data/DataContext.tsx";
import {
  addCategory,
  addUser,
  changeCategoryBudget,
  setCategoryArchived,
  updateCategory,
} from "../../data/firestore.ts";
import { budgetVersionFor } from "../../lib/budget.ts";
import { DEFAULT_CATEGORY_COLOR } from "../../lib/colors.ts";
import { currentMonth, formatMonth } from "../../lib/dates.ts";
import { centsToInput, eurosToCents, isValidPositiveAmount } from "../../lib/money.ts";
import { formatCents } from "../../lib/money.ts";
import type { Category, Dataset } from "../../lib/types.ts";

/** Route a terminal write failure to the shared error banner. Offline writes never
 * reject here — Firestore queues them — so this fires only on genuine errors. */
function syncErrorMessage(context: string, err: unknown): string {
  return `Échec de synchronisation (${context}) : ${err instanceof Error ? err.message : String(err)}`;
}

export function Config({ dataset }: { dataset: Dataset }) {
  return (
    <div>
      <CategoriesSection dataset={dataset} />
      <UsersSection dataset={dataset} />
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
      {active.map((c) => (
        <CategoryRow key={c.id} category={c} dataset={dataset} />
      ))}

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

function CategoryRow({ category, dataset }: { category: Category; dataset: Dataset }) {
  const { notifyError } = useData();
  const month = currentMonth();
  const currentAmount = budgetVersionFor(dataset.budgetVersions, category.id, month);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [amount, setAmount] = useState(centsToInput(currentAmount));
  const [color, setColor] = useState(category.color ?? DEFAULT_CATEGORY_COLOR);

  // Optimistic: queue the writes and close the editor immediately.
  const save = () => {
    if (!isValidPositiveAmount(amount) || name.trim().length === 0) return;
    const patch: { name?: string; color?: string } = {};
    if (name.trim() !== category.name) patch.name = name.trim();
    if (color !== (category.color ?? null)) patch.color = color;
    const ops: Promise<void>[] = [];
    if (Object.keys(patch).length > 0) ops.push(updateCategory(category.id, patch));
    const cents = eurosToCents(amount);
    if (cents !== currentAmount) ops.push(changeCategoryBudget(category.id, cents, month));
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
        <div className="row" style={{ width: "100%", marginTop: 8 }}>
          <button type="button" className="btn btn--primary btn--sm" onClick={save}>
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
        <div className="muted">{formatCents(currentAmount)} / mois</div>
      </div>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
        Modifier
      </button>
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

  return (
    <div className="card">
      <h3>Utilisateurs</h3>
      {dataset.users.length === 0 ? (
        <p className="muted">Aucun utilisateur.</p>
      ) : (
        <div className="chips" style={{ marginBottom: 12 }}>
          {dataset.users.map((u) => (
            <span className="chip" key={u.id}>
              {u.firstName}
            </span>
          ))}
        </div>
      )}
      <form onSubmit={onAdd} className="row">
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
