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
  // `.icon` carries the size: see the rule in global.css. Without it an SVG
  // with no width/height attributes lays out at its container's width.
  className: "icon",
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

/* ---- chrome: navigation, controls, states -------------------------------- */

/** Back, and previous month. */
export function ChevronLeftIcon() {
  return (
    <svg {...BASE}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** Next month, and a collapsed disclosure. */
export function ChevronRightIcon() {
  return (
    <svg {...BASE}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/** An open disclosure, and the account menu's caret. */
export function ChevronDownIcon() {
  return (
    <svg {...BASE}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Move a poste up the list. */
export function ArrowUpIcon() {
  return (
    <svg {...BASE}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

/** Move a poste down the list. */
export function ArrowDownIcon() {
  return (
    <svg {...BASE}>
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </svg>
  );
}

/** The profile you are currently using. */
export function CheckIcon() {
  return (
    <svg {...BASE}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/** Réglages. */
export function SettingsIcon() {
  return (
    <svg {...BASE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Sign out. */
export function PowerIcon() {
  return (
    <svg {...BASE}>
      <path d="M12 3v9" />
      <path d="M6.6 6.6a8 8 0 1 0 10.8 0" />
    </svg>
  );
}

/** Dismiss a sheet or a banner. */
export function CloseIcon() {
  return (
    <svg {...BASE}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/** Pull-to-refresh. */
export function RefreshIcon() {
  return (
    <svg {...BASE}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

/** Add the app to the home screen. */
export function InstallIcon() {
  return (
    <svg {...BASE}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}
