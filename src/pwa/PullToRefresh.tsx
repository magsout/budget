import { type ReactNode, useEffect, useRef, useState } from "react";
import { isStandalone } from "./standalone.ts";
import { useRefreshOnResume } from "./useRefreshOnResume.ts";

const TRIGGER_PX = 70; // pull distance (after resistance) needed to refresh
const MAX_PULL_PX = 110; // clamp so the indicator can't run away
const RESISTANCE = 0.5; // finger travel -> indicator travel
const RESUME_RELOAD_AFTER_MS = 30 * 60_000; // 30 min backgrounded -> reload on resume

/**
 * Custom pull-to-refresh for the installed PWA (standalone mode), where the
 * browser's native gesture is gone. Also reloads on resume after a long
 * background via useRefreshOnResume. Both are no-ops in a normal browser tab,
 * so the native pull-to-refresh keeps working there.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  useRefreshOnResume(RESUME_RELOAD_AFTER_MS);

  const [pull, setPull] = useState(0); // drives the indicator only
  const [refreshing, setRefreshing] = useState(false);

  const enabled = useRef(isStandalone());
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!enabled.current) return;

    const reset = () => {
      if (pullRef.current !== 0) {
        pullRef.current = 0;
        setPull(0);
      }
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || window.scrollY > 0) return;
      const target = e.target as Element | null;
      if (target?.closest(".modal__backdrop")) return; // leave modal scrolling alone
      startY.current = e.touches[0]?.clientY ?? null;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || refreshingRef.current) return;
      const dy = (e.touches[0]?.clientY ?? startY.current) - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        reset();
        return;
      }
      e.preventDefault(); // take the gesture over from native scroll/overscroll
      const dist = Math.min(MAX_PULL_PX, dy * RESISTANCE);
      pullRef.current = dist;
      setPull(dist);
    };

    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= TRIGGER_PX) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(TRIGGER_PX);
        window.location.reload();
      } else {
        reset();
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const visible = enabled.current && (pull > 0 || refreshing);
  const progress = Math.min(1, pull / TRIGGER_PX);

  return (
    <>
      {visible && (
        <div className="ptr" aria-hidden="true">
          <div
            className={`ptr__badge ${refreshing ? "ptr__badge--spin" : ""}`}
            style={{
              transform: `translateY(${pull}px) rotate(${refreshing ? 0 : Math.round(pull * 3)}deg)`,
              opacity: refreshing ? 1 : progress,
            }}
          >
            ↻
          </div>
        </div>
      )}
      {children}
    </>
  );
}
