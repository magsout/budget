import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";
import { useData } from "../data/DataContext.tsx";
import type { User } from "../lib/types.ts";

/** Which household member is currently using the shared account. */
const CURRENT_USER_KEY = "budget:currentUserId";
/** Legacy key written by the expense form before the current-user concept. */
const LEGACY_LAST_USER_KEY = "budget:lastUserId";

interface CurrentUserState {
  /** Persisted id of the current person, or null if none chosen yet. */
  currentUserId: string | null;
  /** The resolved User, or null when the stored id no longer matches anyone. */
  currentUser: User | null;
  /** Remember a new current person (persists to localStorage). */
  setCurrentUser: (id: string) => void;
  /** True when someone must be picked: users exist but none is selected. */
  needsSelection: boolean;
}

const CurrentUserContext = createContext<CurrentUserState | null>(null);

function readInitialId(): string | null {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  if (stored) return stored;
  // Soft-migrate the former "last used" hint so returning users aren't re-asked.
  return localStorage.getItem(LEGACY_LAST_USER_KEY);
}

/**
 * Tracks the current household member across reloads. The account itself is
 * shared, so this is a local UI identity (persisted only on this device) used
 * to pre-fill selectors — never an authentication boundary.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { dataset } = useData();
  const [currentUserId, setCurrentUserId] = useState<string | null>(readInitialId);

  const currentUser = useMemo(
    () => dataset.users.find((u) => u.id === currentUserId) ?? null,
    [dataset.users, currentUserId],
  );

  const setCurrentUser = useCallback((id: string) => {
    setCurrentUserId(id);
    localStorage.setItem(CURRENT_USER_KEY, id);
  }, []);

  const value = useMemo<CurrentUserState>(
    () => ({
      currentUserId,
      currentUser,
      setCurrentUser,
      needsSelection: dataset.users.length > 0 && currentUser === null,
    }),
    [currentUserId, currentUser, setCurrentUser, dataset.users.length],
  );

  return <CurrentUserContext value={value}>{children}</CurrentUserContext>;
}

export function useCurrentUser(): CurrentUserState {
  const ctx = use(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used within <CurrentUserProvider>");
  return ctx;
}
