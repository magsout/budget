/**
 * Small UI preferences that belong to the device, not to the household data —
 * they never go to Firestore.
 *
 * `Storage` is passed in rather than reaching for `window.localStorage`, so these
 * stay pure enough to unit-test without a DOM (same approach as lib/export.ts),
 * and every access is guarded: `localStorage` throws outright in some private
 * browsing modes, and a lost preference must never take the screen down with it.
 */

/** Storage key for a list's fold state. One per list id, so lists stay independent. */
function foldedKey(id: string): string {
  return `budget:listFolded:${id}`;
}

/**
 * Whether the given expense list was left folded. Absent or unreadable reads as
 * false — "everything open" is the default the app should fall back to.
 */
export function readListFolded(storage: Pick<Storage, "getItem">, id: string): boolean {
  try {
    return storage.getItem(foldedKey(id)) === "1";
  } catch {
    return false;
  }
}

/** Remember whether the given expense list is folded. */
export function writeListFolded(
  storage: Pick<Storage, "setItem">,
  id: string,
  folded: boolean,
): void {
  try {
    storage.setItem(foldedKey(id), folded ? "1" : "0");
  } catch {
    // A preference that cannot be saved is not worth an error path.
  }
}
