import { type FormEvent, type ReactNode, useState } from "react";
import { isFirebaseConfigured } from "../firebase.ts";
import { authErrorMessage, useAuth } from "./AuthContext.tsx";

/**
 * Renders a password screen until a real Firebase session exists. The typed
 * password is verified server-side by Firebase Auth — it is never stored in the
 * bundle — so this is a genuine access boundary, not client-side obfuscation.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, signIn } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isFirebaseConfigured) {
    return (
      <div className="gate">
        <div className="gate__card">
          <h1>Configuration manquante</h1>
          <p className="gate__error">
            Les variables <code>VITE_FIREBASE_*</code> ne sont pas définies. Copie{" "}
            <code>.env.example</code> vers <code>.env.local</code> et renseigne la config Firebase.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="gate">
        <div className="gate__card">
          <p>Chargement…</p>
        </div>
      </div>
    );
  }

  if (user) return <>{children}</>;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(password);
    } catch (err) {
      setError(authErrorMessage(err));
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={onSubmit}>
        <h1>Budget</h1>
        <p className="gate__hint">Entre le mot de passe pour accéder au budget.</p>
        <input
          type="password"
          className="input"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          // biome/oxlint: mobile keyboards
          aria-label="Mot de passe"
        />
        {error && <p className="gate__error">{error}</p>}
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting || password.length === 0}
        >
          {submitting ? "Connexion…" : "Entrer"}
        </button>
      </form>
    </div>
  );
}
