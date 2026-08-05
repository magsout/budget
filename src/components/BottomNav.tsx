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
  /**
   * Optional strip shown inside the floating container, above the tabs —
   * the mini-player slot. Render nothing to leave it out entirely.
   */
  slot?: ReactNode;
}

/**
 * Tapping a tab always brings you back to the top: the three screens share one
 * scroll position, so switching while scrolled down would otherwise drop you
 * mid-page in a screen you have not seen yet. Tapping the tab you are already
 * on becomes "back to top", as it does on iOS.
 */
function scrollToTop() {
  if (window.scrollY === 0) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}

/**
 * Floating bottom tab bar. Icon over label, translucent shell inset from the
 * screen edges.
 *
 * There is no router in this app — the active tab is state — so the items are
 * buttons carrying `aria-current="page"`, which is the correct pattern for a
 * tab set without URLs. That attribute is also the only source of truth for the
 * active styling; no parallel class to keep in sync.
 */
export function BottomNav<T extends string>({ tabs, active, onChange, slot }: Props<T>) {
  return (
    <div className="tabbar">
      <div className="tabbar__shell">
        {slot && <div className="tabbar__slot">{slot}</div>}
        <nav className="tabbar__nav" aria-label="Navigation principale">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className="tabbar__item"
              aria-current={tab.id === active ? "page" : undefined}
              onClick={() => {
                onChange(tab.id);
                scrollToTop();
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
