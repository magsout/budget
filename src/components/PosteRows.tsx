import { type CategorySummary, spentPercent } from "../lib/budget.ts";
import { posteColor } from "../lib/colors.ts";
import { originLabel, remainingTone } from "../lib/labels.ts";
import { formatCents, formatCentsPlain } from "../lib/money.ts";
import { PlusIcon } from "./icons.tsx";

interface Props {
  summary: CategorySummary[];
  /** Opens the expense form prefilled with this poste. */
  onPick: (categoryId: string) => void;
}

/**
 * The month's postes as rows of a single card, instead of one card each: three
 * paddings, three shadows and three margins were spending ~120px to separate
 * numbers that are read together.
 *
 * Each row keeps exactly ONE action — "add an expense to this poste" — which is
 * the most frequent gesture in the app. Nothing here may become a second target
 * (a filter, a disclosure): two neighbouring hit areas with different
 * consequences is how you end up logging an expense while trying to expand a row.
 */
export function PosteRows({ summary, onPick }: Props) {
  return (
    <>
      {summary.map(({ category, state }) => {
        const tone = remainingTone(state.remainingCents, state.startingCents);
        const origin = originLabel(state);

        return (
          <button
            type="button"
            key={category.id}
            className="poste-row poste-row--btn"
            onClick={() => onPick(category.id)}
          >
            <span className="poste-row__name">
              <span
                className="poste__dot"
                style={{ background: posteColor(category) }}
                aria-hidden
              />
              {category.name}
            </span>
            {/* Bare numbers, no "Dépensé" prefix: the slash already says it, and
                the prefix was repeated once per poste. `originLabel` stays as TEXT —
                it explains a gap between budget and remaining, and a `title` would
                be unreachable by touch. It composes the report AND the movements
                into one clause so this line never grows a fourth item. */}
            <span className="poste-row__meta muted num">
              {formatCentsPlain(state.spentCents)} / {formatCents(state.startingCents)}
              {origin ? ` · ${origin}` : ""}
            </span>
            <span className={`poste-row__rem num ${tone}`}>
              {formatCents(state.remainingCents)}
            </span>
            <span className="poste-row__add" aria-hidden>
              <PlusIcon />
            </span>
            {/* No aria-label on the button: it would hide the amounts and the
                carry note this row exists to announce. Appending instead keeps
                `getByRole("button", { name: /Courses/ })` matching. */}
            <span className="sr-only"> — ajouter une dépense</span>
            <span className="bar">
              <span
                className="bar__fill"
                style={{ width: `${spentPercent(state)}%`, background: `var(--${tone})` }}
              />
            </span>
          </button>
        );
      })}
    </>
  );
}
