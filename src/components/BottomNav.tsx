import type { ReactNode } from "react";

export interface NavTab<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

interface Props<T extends string> {
  tabs: NavTab<T>[];
  active: T;
  onChange: (id: T) => void;
}

/**
 * Fixed bottom navigation — icon above label, the reach a phone actually has.
 * The bar is full-bleed so it meets the screen edges, while its items stay
 * within `--maxw` like the rest of the app.
 *
 * `aria-current="page"` is the single source of truth for the active tab: the
 * highlight is styled from that attribute rather than a parallel class.
 */
export function BottomNav<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      <div className="tabbar__inner">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className="tabbar__item"
            aria-current={tab.id === active ? "page" : undefined}
            onClick={() => onChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
