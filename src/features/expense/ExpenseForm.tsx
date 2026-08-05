import { type FormEvent, useMemo, useState } from "react";
import { Modal } from "../../components/Modal.tsx";
import { useData } from "../../data/DataContext.tsx";
import { addExpense, softDeleteExpense, updateExpense } from "../../data/firestore.ts";
import { categoriesActiveIn, frequentExpenses } from "../../lib/budget.ts";
import { currentMonth, localToday, prevMonth } from "../../lib/dates.ts";
import { centsToInput, eurosToCents, formatCents, isValidPositiveAmount } from "../../lib/money.ts";
import type { Dataset, Expense } from "../../lib/types.ts";
import { activeUsers } from "../../lib/users.ts";
import { useCurrentUser } from "../../user/CurrentUserContext.tsx";

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
  const { notifyError } = useData();

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

  const { currentUserId } = useCurrentUser();

  const users = useMemo(() => {
    const list = activeUsers(dataset.users);
    // In edit mode, keep the expense's own (possibly retired) author selectable.
    if (expense && !list.some((u) => u.id === expense.userId)) {
      const own = dataset.users.find((u) => u.id === expense.userId);
      if (own) list.push(own);
    }
    return list;
  }, [dataset.users, expense]);

  const [amount, setAmount] = useState(expense ? centsToInput(expense.amountCents) : "");
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [userId, setUserId] = useState(
    expense?.userId ??
      (currentUserId && users.some((u) => u.id === currentUserId)
        ? currentUserId
        : (users[0]?.id ?? "")),
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [date, setDate] = useState(expense?.date ?? localToday());
  const [submitting, setSubmitting] = useState(false);

  const selectedColor = categories.find((c) => c.id === categoryId)?.color;

  // Habits from the last three months, offered as one-tap prefills. Only when
  // creating: in edit mode the fields already hold the values being changed.
  const frequent = useMemo(() => {
    if (editing) return [];
    const since = prevMonth(prevMonth(currentMonth()));
    return frequentExpenses(dataset.expenses, { since }).filter((f) =>
      categories.some((c) => c.id === f.categoryId),
    );
  }, [dataset.expenses, categories, editing]);

  const applyFrequent = (amountCents: number, category: string, desc: string | null) => {
    setAmount(centsToInput(amountCents));
    setCategoryId(category);
    setDescription(desc ?? "");
  };

  const canSubmit =
    isValidPositiveAmount(amount) &&
    categoryId !== "" &&
    userId !== "" &&
    date !== "" &&
    !submitting;

  // Optimistic / offline-first: fire the write and close immediately. Firestore
  // applies it to the local cache right away (the listener re-renders the change)
  // and queues it for background sync — awaiting the server ack would hang offline.
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const payload = {
      categoryId,
      userId,
      amountCents: eurosToCents(amount),
      description: description || null,
      date,
    };
    const op = editing ? updateExpense(expense.id, payload) : addExpense(payload);
    op.catch((err: unknown) =>
      notifyError(
        `Échec de synchronisation de la dépense : ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    onClose();
  };

  const onDelete = () => {
    if (!expense) return;
    if (!confirm("Supprimer cette dépense ?")) return;
    setSubmitting(true);
    softDeleteExpense(expense.id).catch((err: unknown) =>
      notifyError(
        `Échec de synchronisation de la suppression : ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    onClose();
  };

  const needsSetup = categories.length === 0 || users.length === 0;

  return (
    <Modal title={editing ? "Modifier la dépense" : "Ajouter une dépense"} onClose={onClose}>
      {needsSetup ? (
        <p className="empty">
          Ajoute d'abord au moins un poste de dépenses et un utilisateur dans l'onglet
          <strong> Config</strong>.
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          {frequent.length > 0 && (
            <div className="field">
              <span className="field__label">Fréquent</span>
              <div className="chips chips--strip">
                {frequent.map((f) => {
                  const category = categories.find((c) => c.id === f.categoryId);
                  return (
                    <button
                      type="button"
                      key={`${f.categoryId}-${f.description}-${f.amountCents}`}
                      className="chip chip--poste"
                      onClick={() => applyFrequent(f.amountCents, f.categoryId, f.description)}
                    >
                      <span
                        className="poste__dot"
                        style={category?.color ? { background: category.color } : undefined}
                      />
                      {f.description ?? category?.name} · {formatCents(f.amountCents)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
            <div className="select-with-dot">
              <span
                className="poste__dot"
                style={selectedColor ? { background: selectedColor } : undefined}
              />
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
                {users.map((u) => (
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
