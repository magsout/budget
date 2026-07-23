import { useState } from "react";
import { useAuth } from "./auth/AuthContext.tsx";
import { useData } from "./data/DataContext.tsx";
import { Config } from "./features/config/Config.tsx";
import { Dashboard } from "./features/dashboard/Dashboard.tsx";
import { History } from "./features/history/History.tsx";
import { InstallBanner } from "./pwa/InstallBanner.tsx";
import { PullToRefresh } from "./pwa/PullToRefresh.tsx";
import { useCurrentUser } from "./user/CurrentUserContext.tsx";

type Tab = "dashboard" | "history" | "config";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Budget" },
  { id: "history", label: "Historique" },
  { id: "config", label: "Config" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { signOut } = useAuth();
  const { dataset, loading, error, syncing, pendingWrites } = useData();
  const { currentUserId, setCurrentUser } = useCurrentUser();

  // Discreet indicator: data shown from cache (offline / not yet confirmed) or
  // local writes still being pushed to the server.
  const showSync = syncing || pendingWrites;
  const syncLabel = pendingWrites ? "Synchronisation…" : "Mise à jour…";

  return (
    <PullToRefresh>
      <div className="app">
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
            {dataset.users.length > 0 && (
              <select
                className="select select--inline"
                value={currentUserId ?? ""}
                onChange={(e) => setCurrentUser(e.target.value)}
                aria-label="Utilisateur connecté"
              >
                {currentUserId === null && <option value="">Qui es-tu ?</option>}
                {dataset.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName}
                  </option>
                ))}
              </select>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => signOut()}>
              Déconnexion
            </button>
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
          <Config dataset={dataset} />
        )}
      </div>
    </PullToRefresh>
  );
}
