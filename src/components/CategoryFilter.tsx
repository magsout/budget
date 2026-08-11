import { categoryExpenseCounts } from "../lib/budget.ts";
import { posteColor } from "../lib/colors.ts";
import type { Category, Expense } from "../lib/types.ts";

interface Props {
  /** The month's rows the filter applies to (already excluding deleted ones). */
  expenses: Expense[];
  categories: Category[];
  /** Selected poste id, or null for "Tous". */
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

/**
 * Per-poste filter strip for a month's expense list, shared by the Budget and
 * Historique tabs. Renders nothing when a single poste holds every row —
 * "Tous" would show exactly the same list.
 *
 * Pair it with `filterExpensesByCategory`, which falls back to the full list
 * when the selected poste no longer has rows; the strip highlights "Tous" in
 * that same case, so the two never disagree.
 */
export function CategoryFilter({ expenses, categories, value, onChange }: Props) {
  const filters = categoryExpenseCounts(expenses, categories);
  if (filters.length <= 1) return null;

  const active = filters.some((f) => f.category.id === value) ? value : null;

  return (
    <div className="chips chips--strip">
      <button
        type="button"
        className={`chip ${active === null ? "chip--active" : ""}`}
        aria-pressed={active === null}
        onClick={() => onChange(null)}
      >
        Tous ({expenses.length})
      </button>
      {filters.map(({ category, count }) => (
        <button
          type="button"
          key={category.id}
          className={`chip chip--poste ${active === category.id ? "chip--active" : ""}`}
          aria-pressed={active === category.id}
          onClick={() => onChange(category.id)}
        >
          <span className="poste__dot" style={{ background: posteColor(category) }} />
          {category.name} ({count})
        </button>
      ))}
    </div>
  );
}
