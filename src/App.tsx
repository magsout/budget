import { useState } from "react";
import { useData } from "./data/DataContext.tsx";
import { Account } from "./features/account/Account.tsx";
import { Config } from "./features/config/Config.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { History } from "./features/history/History.tsx";
import { AccountMenu } from "./features/menu/AccountMenu.tsx";
import { InstallBanner } from "./pwa/InstallBanner.tsx";
import { PullToRefresh } from "./pwa/PullToRefresh.tsx";

type Tab = "dashboard" | "history" | "account";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Budget" },
  { id: "history", label: "Historique" },
  { id: "account", label: "Compte" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [configOpen, setConfigOpen] = useState(false);
  const { dataset, loading, error, syncing, pendingWrites } = useData();

  // Discreet indicator: data shown from cache (offline / not yet confirmed) or
  // local writes still being pushed to the server.
  const showSync = syncing || pendingWrites;
  const syncLabel = pendingWrites ? "Synchronisation…" : "Mise à jour…";

  return (
    <PullToRefresh>
      <div className="app">
        {configOpen ? (
          <>
            <div className="topbar topbar--sub">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfigOpen(false)}
                aria-label="Retour"
              >
                ‹ Retour
              </button>
              <span className="topbar__title">Réglages</span>
              <span className="topbar__sub-spacer" aria-hidden />
            </div>
            <Config dataset={dataset} />
          </>
        ) : (
          <>
            <div className="topbar">
              <span className="topbar__brand">
                <span className="topbar__title">Budget</span>
                {showSync && (
                  <span
                    className="topbar__sync"
                    role="status"
                    aria-label={syncLabel}
                    title={syncLabel}
                  />
                )}
              </span>
              <div className="topbar__actions">
                <AccountMenu onOpenConfig={() => setConfigOpen(true)} />
              </div>
            </div>

            <nav className="tabs">
              {TABS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`tabs__btn ${tab === t.id ? "tabs__btn--active" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <InstallBanner />

            {error && <div className="card gate__error">Erreur de synchronisation : {error}</div>}

            {loading ? (
              <div className="card empty">Chargement des données…</div>
            ) : tab === "dashboard" ? (
              <Dashboard dataset={dataset} />
            ) : tab === "history" ? (
              <History dataset={dataset} />
            ) : (
              <Account dataset={dataset} />
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
