import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { AuthGate } from "./auth/AuthGate.tsx";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { DataProvider } from "./data/DataContext.tsx";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root introuvable");

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <DataProvider>
          <App />
        </DataProvider>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
