import { useState } from "react";
import { BottomNav, type NavTab } from "./components/BottomNav.tsx";
import { BudgetIcon, CompteIcon, HistoriqueIcon } from "./components/icons.tsx";
import { useData } from "./data/DataContext.tsx";
import { Account } from "./features/account/Account.tsx";
import { Config } from "./features/config/Config.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { History } from "./features/history/History.tsx";
import { AccountMenu } from "./features/menu/AccountMenu.tsx";
import { InstallBanner } from "./pwa/InstallBanner.tsx";
import { PullToRefresh } from "./pwa/PullToRefresh.tsx";

type Tab = "dashboard" | "history" | "account";

const TABS: NavTab<Tab>[] = [
  { id: "dashboard", label: "Budget", icon: <BudgetIcon /> },
  { id: "history", label: "Historique", icon: <HistoriqueIcon /> },
  { id: "account", label: "Compte", icon: <CompteIcon /> },
];

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [configOpen, setConfigOpen] = useState(false);
  const { dataset, loading, error, syncing, pendingWrites } = useData();

  // Data shown from cache (offline / not yet confirmed) or local writes still
  // being pushed. Rides in the tab bar's slot: transient, like a mini-player.
  const showSync = syncing || pendingWrites;
  const syncLabel = pendingWrites ? "Synchronisation…" : "Mise à jour…";
  const syncPill = showSync ? (
    <span className="sync-pill" role="status">
      <span className="sync-pill__spinner" aria-hidden />
      {syncLabel}
    </span>
  ) : undefined;

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
              <span className="topbar__title">Budget</span>
              <div className="topbar__actions">
                <AccountMenu onOpenConfig={() => setConfigOpen(true)} />
              </div>
            </div>

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

            {/* Réglages is a sub-page, not a tab: it owns a « ‹ Retour » button
                and no tab could legitimately be marked active there. */}
            <BottomNav tabs={TABS} active={tab} onChange={setTab} slot={syncPill} />
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
