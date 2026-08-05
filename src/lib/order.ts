/**
 * Ordering helpers for hand-sorted lists (currently the postes de dépenses).
 * Kept separate from the budget maths: this is pure list manipulation, and the
 * persisted `sortOrder` is derived from the resulting position, never the other
 * way round.
 */

/**
 * Move the item at `index` by `delta` positions, returning a new array.
 * Out-of-range moves are no-ops (the array is returned unchanged), so callers
 * can wire up ↑/↓ buttons without guarding the first and last rows themselves.
 */
export function moveInList<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length) return items;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}
