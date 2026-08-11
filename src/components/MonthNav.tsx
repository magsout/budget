import { formatMonth, type MonthKey, nextMonth, prevMonth } from "../lib/dates.ts";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons.tsx";

interface Props {
  month: MonthKey;
  onChange: (month: MonthKey) => void;
  /** Extra classes, e.g. `month-nav--inline` when it sits inside a card. */
  className?: string;
}

/**
 * The month stepper. Unbounded in both directions: future months preview planned
 * items and past months recall them.
 */
export function MonthNav({ month, onChange, className }: Props) {
  return (
    <div className={`month-nav ${className ?? ""}`}>
      <button
        type="button"
        className="btn btn--ghost month-nav__btn"
        onClick={() => onChange(prevMonth(month))}
        aria-label="Mois précédent"
      >
        <ChevronLeftIcon />
      </button>
      <span className="month-nav__label">{formatMonth(month)}</span>
      <button
        type="button"
        className="btn btn--ghost month-nav__btn"
        onClick={() => onChange(nextMonth(month))}
        aria-label="Mois suivant"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
