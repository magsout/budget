interface Props {
  value: string;
  onChange: (query: string) => void;
}

/**
 * Search field for an expense list, shared by the Budget and Historique tabs so
 * the two can't drift apart in wording or behaviour. Pair it with
 * `searchExpenses`, which takes the raw value (a blank query filters nothing).
 *
 * `type="search"` for the native clear button — worth it on a phone, where
 * backspacing a query is tedious.
 */
export function ExpenseSearch({ value, onChange }: Props) {
  return (
    <input
      type="search"
      className="input"
      style={{ marginBottom: 12 }}
      placeholder="Rechercher : 42,50 · 7/8 · Carrefour"
      aria-label="Rechercher une dépense par montant, date ou description"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
