import { useState } from "react";
import { useAuth } from "../../auth/AuthContext.tsx";
import { Modal } from "../../components/Modal.tsx";
import { useData } from "../../data/DataContext.tsx";
import { avatarColorFor } from "../../lib/colors.ts";
import { useCurrentUser } from "../../user/CurrentUserContext.tsx";

const initialOf = (name: string) => name.charAt(0).toUpperCase();

/**
 * Account menu in the top-right corner. Its label is the current household
 * member; tapping it opens a bottom sheet (reusing Modal) grouping the "compte"
 * actions: switch profile, open settings, and sign out. Settings live behind
 * `onOpenConfig` because the parent owns the full-screen Config sub-page.
 */
export function AccountMenu({ onOpenConfig }: { onOpenConfig: () => void }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const { dataset } = useData();
  const { currentUser, currentUserId, setCurrentUser } = useCurrentUser();

  const label = currentUser?.firstName ?? "Compte";
  const initial = currentUser ? initialOf(currentUser.firstName) : "?";
  // Deterministic per-user hue; falls back to the theme primary when nobody is picked.
  const triggerColor = currentUser ? avatarColorFor(currentUser.id) : undefined;

  return (
    <>
      <button
        type="button"
        className="account-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="account-trigger__avatar" style={{ background: triggerColor }} aria-hidden>
          {initial}
        </span>
        <span className="account-trigger__name">{label}</span>
        <span className="account-trigger__caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          {dataset.users.length > 1 && (
            <div className="account-menu__section">
              <p className="account-menu__label">Changer de profil</p>
              {dataset.users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`list-item list-item--btn ${u.id === currentUserId ? "is-active" : ""}`}
                  onClick={() => {
                    setCurrentUser(u.id);
                    setOpen(false);
                  }}
                >
                  <span className="account-menu__row-main">
                    <span
                      className="account-menu__avatar"
                      style={{ background: avatarColorFor(u.id) }}
                      aria-hidden
                    >
                      {initialOf(u.firstName)}
                    </span>
                    {u.firstName}
                  </span>
                  {u.id === currentUserId && <span aria-hidden>✓</span>}
                </button>
              ))}
            </div>
          )}

          <div className="account-menu__section">
            <button
              type="button"
              className="list-item list-item--btn"
              onClick={() => {
                setOpen(false);
                onOpenConfig();
              }}
            >
              <span>⚙ Réglages</span>
            </button>
            <button
              type="button"
              className="list-item list-item--btn account-menu__danger"
              onClick={() => signOut()}
            >
              <span>⏻ Déconnexion</span>
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
