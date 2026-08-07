/**
 * Inline SVG icons. No icon library: the bundle is already large, and these few
 * paths cost about a kilobyte. They draw in `currentColor`, so the tab bar's
 * active/inactive colours (and the dark theme) come for free.
 *
 * Every icon is `aria-hidden`: it sits inside a button that already carries a
 * visible label or an aria-label, and letting the SVG contribute to the
 * accessible name would break both the reading order and the e2e selectors.
 */

const BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Wallet — the postes de dépenses and what is left on them. */
export function BudgetIcon() {
  return (
    <svg {...BASE}>
      <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />
      <path d="M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
      <path d="M21 11h-4a2 2 0 0 0 0 4h4z" />
    </svg>
  );
}

/** Clock turned back — past months. */
export function HistoriqueIcon() {
  return (
    <svg {...BASE}>
      <path d="M3 12a9 9 0 1 0 2.6-6.4" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Bars — the monthly cashflow. */
export function CompteIcon() {
  return (
    <svg {...BASE}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-4" />
      <path d="M13 16V8" />
      <path d="M18 16v-6" />
    </svg>
  );
}

/** Pencil — the row is editable. */
export function PencilIcon() {
  return (
    <svg {...BASE}>
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
      <path d="M15 5l4 4" />
    </svg>
  );
}

/** Magnifier — marks the search field. */
export function SearchIcon() {
  return (
    <svg {...BASE}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

/** Plus — the add-expense action. Heavier stroke: it sits alone on the FAB. */
export function PlusIcon() {
  return (
    <svg {...BASE} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
