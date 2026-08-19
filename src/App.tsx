import { useState } from "react";
import { BottomNav, type NavTab } from "./components/BottomNav.tsx";
import { BudgetIcon, ChevronLeftIcon, CompteIcon, HistoriqueIcon } from "./components/icons.tsx";
import { useData } from "./data/DataContext.tsx";
import { Account } from "./features/account/Account.tsx";
import { Config } from "./features/config/Config.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { History } from "./features/history/History.tsx";
import { Rebalance } from "./features/rebalance/Rebalance.tsx";
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
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const { dataset, loading, error, syncing, pendingWrites } = useData();

  // Data shown from cache (offline / not yet confirmed) or local writes still
  // being pushed. Rides in the tab bar's slot: transient, like a mini-player.
  const syncPill =
    syncing || pendingWrites ? (
      <span className="sync-pill" role="status">
        <span className="sync-pill__spinner" aria-hidden />
        {pendingWrites ? "Synchronisation…" : "Mise à jour…"}
      </span>
    ) : undefined;

  /* Réglages and Répartition are sub-pages, not tabs: each owns a « ‹ Retour »
     and no tab could legitimately be marked active while one is open. One
     descriptor rather than a branch per page, so the shell is written once. */
  const subPage = rebalanceOpen
    ? {
        title: "Répartition",
        content: <Rebalance dataset={dataset} />,
        close: () => setRebalanceOpen(false),
      }
    : configOpen
      ? {
          title: "Réglages",
          content: <Config dataset={dataset} />,
          close: () => setConfigOpen(false),
        }
      : null;

  return (
    <PullToRefresh>
      <div className="app">
        {subPage ? (
          <>
            <div className="topbar topbar--sub">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={subPage.close}
                aria-label="Retour"
              >
                <ChevronLeftIcon />
                Retour
              </button>
              <span className="topbar__title">{subPage.title}</span>
              <span className="topbar__sub-spacer" aria-hidden />
            </div>
            {subPage.content}
          </>
        ) : (
          <>
            <div className="topbar">
              <span className="topbar__title">Budget</span>
              <div className="topbar__actions">
                <AccountMenu
                  onOpenConfig={() => setConfigOpen(true)}
                  onOpenRebalance={() => setRebalanceOpen(true)}
                />
              </div>
            </div>

            <InstallBanner />

            {error && <div className="card gate__error">Erreur de synchronisation : {error}</div>}

            {loading ? (
              <div className="card empty">Chargement des données…</div>
            ) : tab === "dashboard" ? (
              <Dashboard dataset={dataset} onRebalance={() => setRebalanceOpen(true)} />
            ) : tab === "history" ? (
              <History dataset={dataset} />
            ) : (
              <Account dataset={dataset} />
            )}

            <BottomNav tabs={TABS} active={tab} onChange={setTab} slot={syncPill} />
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
