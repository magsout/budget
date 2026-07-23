import type { ReactNode } from "react";
import { useData } from "../data/DataContext.tsx";
import { useCurrentUser } from "./CurrentUserContext.tsx";

/**
 * Once the data has loaded, asks which household member is using the app before
 * showing the content. Skipped entirely when no user exists yet (the person is
 * sent to Config to create one) so the app is never blocked on an empty list.
 */
export function CurrentUserGate({ children }: { children: ReactNode }) {
  const { dataset, loading } = useData();
  const { needsSelection, setCurrentUser } = useCurrentUser();

  // Wait for the first snapshot; don't flash the picker before users arrive.
  if (loading) return <>{children}</>;
  if (!needsSelection) return <>{children}</>;

  return (
    <div className="gate">
      <div className="gate__card">
        <h1>Qui es-tu ?</h1>
        <p className="gate__hint">Choisis ton profil pour préremplir tes dépenses.</p>
        <div className="user-choices">
          {dataset.users.map((u) => (
            <button
              key={u.id}
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => setCurrentUser(u.id)}
            >
              {u.firstName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
