import { type FormEvent, useState } from "react";
import { Modal } from "../../components/Modal.tsx";
import { addExpense } from "../../data/firestore.ts";
import { categoriesActiveIn } from "../../lib/budget.ts";
import { currentMonth, localToday } from "../../lib/dates.ts";
import { eurosToCents, isValidPositiveAmount } from "../../lib/money.ts";
import type { Dataset } from "../../lib/types.ts";

const LAST_USER_KEY = "budget:lastUserId";

interface Props {
  dataset: Dataset;
  onClose: () => void;
  defaultCategoryId?: string;
}

export function ExpenseForm({ dataset, onClose, defaultCategoryId }: Props) {
  const categories = categoriesActiveIn(dataset, currentMonth()).toSorted(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  const lastUser = localStorage.getItem(LAST_USER_KEY) ?? "";

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? "");
  const [userId, setUserId] = useState(
    dataset.users.some((u) => u.id === lastUser) ? lastUser : (dataset.users[0]?.id ?? ""),
  );
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(localToday());
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
    try {
      await addExpense({
        categoryId,
        userId,
        amountCents: eurosToCents(amount),
        description: description || null,
        date,
      });
      localStorage.setItem(LAST_USER_KEY, userId);
      onClose();
    } catch {
      setError("Enregistrement impossible. Vérifie ta connexion.");
      setSubmitting(false);
    }
  };

  const needsSetup = categories.length === 0 || dataset.users.length === 0;

  return (
    <Modal title="Ajouter une dépense" onClose={onClose}>
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
            {submitting ? "Enregistrement…" : "Ajouter la dépense"}
          </button>
        </form>
      )}
    </Modal>
  );
}
