/**
 * Fixture harness entry — the real <App /> rendered against FIXTURE_DATASET,
 * with the auth gate and the Firestore subscription removed.
 *
 * Served in dev at /budget/fixture.html, and built only when VITE_E2E=1 (see
 * vite.config.ts), so it never ships to GitHub Pages. Writes are queued by
 * Firestore and simply never confirmed — nothing here touches real data.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../App.tsx";
import { AuthProvider } from "../auth/AuthContext.tsx";
import { StaticDataProvider } from "../data/DataContext.tsx";
import { CurrentUserProvider } from "../user/CurrentUserContext.tsx";
import "../styles/global.css";
import { FIXTURE_DATASET } from "./dataset.ts";

// Pin the current person so the "Qui es-tu ?" gate never blocks the harness.
localStorage.setItem("budget:currentUserId", FIXTURE_DATASET.users[0].id);

const root = document.getElementById("root");
if (!root) throw new Error("#root introuvable");

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <StaticDataProvider dataset={FIXTURE_DATASET}>
        <CurrentUserProvider>
          <App />
        </CurrentUserProvider>
      </StaticDataProvider>
    </AuthProvider>
  </StrictMode>,
);
