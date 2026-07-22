import { useState } from "react";
import { useInstallPrompt } from "./useInstallPrompt.ts";

const DISMISS_KEY = "budget:installDismissed";

/** Discreet, dismissible prompt inviting the user to install the PWA. */
export function InstallBanner() {
  const { installed, canPrompt, iosHint, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");

  if (installed || dismissed) return null;
  if (!canPrompt && !iosHint) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="install">
      <span className="install__icon" aria-hidden="true">
        🐷
      </span>
      {canPrompt ? (
        <>
          <span className="install__text">Installe Budget sur ton écran d'accueil.</span>
          <button type="button" className="btn btn--primary btn--sm" onClick={promptInstall}>
            Installer
          </button>
        </>
      ) : (
        <span className="install__text">
          Installe l'app : <strong>Partager</strong> → <strong>Sur l'écran d'accueil</strong>.
        </span>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        onClick={dismiss}
        aria-label="Masquer"
      >
        ✕
      </button>
    </div>
  );
}
