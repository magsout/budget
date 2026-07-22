import { useEffect } from "react";
import { isStandalone } from "./standalone.ts";

/**
 * When the installed PWA is reopened after being backgrounded longer than
 * `thresholdMs`, reload the page. This guarantees fresh collaborative data and
 * picks up a newly deployed version after a long sleep — while a quick
 * app-switch (below the threshold) does nothing, since the live onSnapshot
 * listeners reconnect on their own. No-op outside standalone mode.
 */
export function useRefreshOnResume(thresholdMs: number): void {
  useEffect(() => {
    if (!isStandalone()) return;

    let hiddenAt: number | null = null;

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible") {
        if (hiddenAt !== null && Date.now() - hiddenAt > thresholdMs) {
          window.location.reload();
        }
        hiddenAt = null;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [thresholdMs]);
}
