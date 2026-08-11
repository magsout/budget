import { avatarColorFor, posteColor } from "../lib/colors.ts";
import { formatDate } from "../lib/dates.ts";
import { formatCents } from "../lib/money.ts";
import type { Category, Expense, User } from "../lib/types.ts";
import { PencilIcon } from "./icons.tsx";

interface Props {
  expense: Expense;
  /** Resolved once by the caller — the row must not search a list per render. */
  category: Category | undefined;
  user: User | undefined;
  /** When given, the whole row becomes the button that opens it for editing. */
  onEdit?: (expense: Expense) => void;
}

/**
 * One expense, on ONE line. The date lives in the day header above it, which is
 * what frees the second line and takes the row from 64px to 44px.
 *
 * It keeps `.list-item` and `.list-item--btn` and only ADDS classes: those two are
 * the app's row vocabulary (Config and AccountMenu render 13 more of them) and the
 * e2e suite counts them.
 */
export function ExpenseRow({ expense, category, user, onEdit }: Props) {
  const posteName = category?.name ?? "—";
  const who = user?.firstName ?? "—";

  const content = (
    <>
      <span
        className="poste__dot xrow__dot"
        style={category ? { background: posteColor(category) } : undefined}
        aria-hidden
      />
      {/* The description identifies the row, so it leads; the poste follows in
          muted text, and stands in for it when there is none. Never a dot alone:
          `Category.color` is optional, so color cannot be the only channel.

          Only the DESCRIPTION shrinks. Ellipsizing the pair as one block ate the
          poste name first ("Anniversaire Gwladys · …"), which drops the one thing
          that says which budget the row hit — and reads as if the description
          itself were cut. A clipped description is still recognisable from its
          start, and the full text is one tap away in the edit sheet. */}
      <span className="xrow__label">
        <span className="xrow__desc">{expense.description ?? posteName}</span>
        {expense.description && <span className="xrow__poste muted"> · {posteName}</span>}
      </span>
      <span
        className="xrow__who"
        style={user ? { background: avatarColorFor(user.id) } : undefined}
        aria-hidden
      >
        {who.charAt(0).toUpperCase()}
      </span>
      <span className="xrow__amount num">{formatCents(expense.amountCents)}</span>
      {/* The date moved to the day header and the author is now just an initial,
          so both are restated here for screen readers — and this is also what
          keeps them in `textContent` for the e2e text assertions. */}
      <span className="sr-only">
        , {formatDate(expense.date)}, {who}
      </span>
      {onEdit && (
        <span className="list-item__edit">
          <PencilIcon />
        </span>
      )}
    </>
  );

  // No aria-label on the button: it would replace this content wholesale, losing
  // the amount, the date and the author it just spelled out.
  return onEdit ? (
    <button
      type="button"
      className="list-item list-item--btn list-item--dense xrow xrow--btn"
      onClick={() => onEdit(expense)}
    >
      {content}
    </button>
  ) : (
    <div className="list-item list-item--dense xrow">{content}</div>
  );
}
