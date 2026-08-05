import { type ReactNode, useEffect, useState } from "react";

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

/** Scroll past this before the bar is allowed to shrink. */
const SHRINK_AFTER_PX = 60;
/** Ignore jitter below this, so a shaky thumb doesn't flip the state. */
const DIRECTION_NOISE_PX = 6;

/**
 * True while the page is being scrolled DOWN (and past a small threshold).
 *
 * The hook only flips a boolean — every size change is a CSS transition, so
 * nothing is animated from JS. Reads are rAF-throttled and the listener is
 * passive, so this never fights the scroller.
 */
function useCompactOnScroll(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - last;
        if (Math.abs(delta) >= DIRECTION_NOISE_PX) {
          // Near the top the bar is always full: that is where you land, and
          // rubber-band scrolling would otherwise flicker it.
          setCompact(y > SHRINK_AFTER_PX && delta > 0);
          last = y;
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return compact;
}

/**
 * Floating bottom tab bar. Icon over label, translucent shell inset from the
 * screen edges, shrinking to icons-only when you scroll down.
 *
 * There is no router in this app — the active tab is state — so the items are
 * buttons carrying `aria-current="page"`, which is the correct pattern for a
 * tab set without URLs. That attribute is also the only source of truth for the
 * active styling; no parallel class to keep in sync.
 */
export function BottomNav<T extends string>({ tabs, active, onChange, slot }: Props<T>) {
  const compact = useCompactOnScroll();

  return (
    <div className={`tabbar ${compact ? "tabbar--compact" : ""}`}>
      <div className="tabbar__shell">
        {slot && <div className="tabbar__slot">{slot}</div>}
        <nav className="tabbar__nav" aria-label="Navigation principale">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className="tabbar__item"
              aria-current={tab.id === active ? "page" : undefined}
              onClick={() => onChange(tab.id)}
            >
              {tab.icon}
              <span className="tabbar__label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
