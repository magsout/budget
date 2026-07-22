import { type FormEvent, useMemo, useState } from "react";
import { Modal } from "../../components/Modal.tsx";
import { addExpense, softDeleteExpense, updateExpense } from "../../data/firestore.ts";
import { categoriesActiveIn } from "../../lib/budget.ts";
import { currentMonth, localToday } from "../../lib/dates.ts";
import { centsToInput, eurosToCents, isValidPositiveAmount } from "../../lib/money.ts";
import type { Dataset, Expense } from "../../lib/types.ts";

const LAST_USER_KEY = "budget:lastUserId";

interface Props {
  dataset: Dataset;
  onClose: () => void;
  /** Prefill the category when creating (e.g. from a poste card). */
  defaultCategoryId?: string;
  /** When provided, the form edits this expense instead of creating one. */
  expense?: Expense;
}

export function ExpenseForm({ dataset, onClose, defaultCategoryId, expense }: Props) {
  const editing = expense !== undefined;

  const categories = useMemo(() => {
    const list = categoriesActiveIn(dataset, currentMonth()).toSorted(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    // In edit mode, keep the expense's own (possibly archived) category selectable.
    if (expense && !list.some((c) => c.id === expense.categoryId)) {
      const own = dataset.categories.find((c) => c.id === expense.categoryId);
      if (own) list.push(own);
    }
    return list;
  }, [dataset, expense]);

  const lastUser = localStorage.getItem(LAST_USER_KEY) ?? "";

  const [amount, setAmount] = useState(expense ? centsToInput(expense.amountCents) : "");
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [userId, setUserId] = useState(
    expense?.userId ??
      (dataset.users.some((u) => u.id === lastUser) ? lastUser : (dataset.users[0]?.id ?? "")),
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [date, setDate] = useState(expense?.date ?? localToday());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    isValidPositiveAmount(amount) &&
    categoryId !== "" &&
    userId !== "" &&
    date !== "" &&
    !submitting;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const payload = {
      categoryId,
      userId,
      amountCents: eurosToCents(amount),
      description: description || null,
      date,
    };
    try {
      if (editing) {
        await updateExpense(expense.id, payload);
      } else {
        await addExpense(payload);
      }
      localStorage.setItem(LAST_USER_KEY, userId);
      onClose();
    } catch {
      setError("Enregistrement impossible. Vérifie ta connexion.");
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!expense) return;
    if (!confirm("Supprimer cette dépense ?")) return;
    setSubmitting(true);
    try {
      await softDeleteExpense(expense.id);
      onClose();
    } catch {
      setError("Suppression impossible. Vérifie ta connexion.");
      setSubmitting(false);
    }
  };

  const needsSetup = categories.length === 0 || dataset.users.length === 0;

  return (
    <Modal title={editing ? "Modifier la dépense" : "Ajouter une dépense"} onClose={onClose}>
      {needsSetup ? (
        <p className="empty">
          Ajoute d'abord au moins un poste de dépenses et un utilisateur dans l'onglet
          <strong> Config</strong>.
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="amount">
              Montant (€)
            </label>
            <input
              id="amount"
              className="input"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="category">
              Poste
            </label>
            <select
              id="category"
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="row">
            <div className="field">
              <label className="field__label" htmlFor="user">
                Qui
              </label>
              <select
                id="user"
                className="select"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                {dataset.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="date">
                Date
              </label>
              <input
                id="date"
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="description">
              Description (optionnel)
            </label>
            <input
              id="description"
              className="input"
              placeholder="Ex : Carrefour"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && <p className="gate__error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={!canSubmit}>
            {submitting ? "Enregistrement…" : editing ? "Enregistrer" : "Ajouter la dépense"}
          </button>

          {editing && (
            <button
              type="button"
              className="btn btn--ghost btn--danger btn--block"
              onClick={onDelete}
              disabled={submitting}
              style={{ marginTop: 8 }}
            >
              Supprimer la dépense
            </button>
          )}
        </form>
      )}
    </Modal>
  );
}
