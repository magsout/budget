import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { AuthGate } from "./auth/AuthGate.tsx";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { DataProvider } from "./data/DataContext.tsx";
import { CurrentUserProvider } from "./user/CurrentUserContext.tsx";
import { CurrentUserGate } from "./user/CurrentUserGate.tsx";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root introuvable");

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <DataProvider>
          <CurrentUserProvider>
            <CurrentUserGate>
              <App />
            </CurrentUserGate>
          </CurrentUserProvider>
        </DataProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
