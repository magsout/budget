/**
 * Preset palette for category ("poste") colors. A small, curated set keeps the
 * dots visually consistent and readable in both light and dark themes, while
 * `isHexColor` lets us validate anything stored (or migrated) before rendering.
 */
export const CATEGORY_COLORS: readonly string[] = [
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#d97706", // amber
  "#7c3aed", // violet
  "#db2777", // pink
  "#0891b2", // cyan
  "#65a30d", // lime
  "#ea580c", // orange
  "#475569", // slate
];

/** Fallback used when a poste has no explicit color yet. */
export const DEFAULT_CATEGORY_COLOR: string = CATEGORY_COLORS[0];

/** True for a `#rgb` or `#rrggbb` hex string. */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * Pick a stable avatar color for a seed (a user id). Deterministic — the same
 * person always gets the same hue — so there's no stored field to migrate,
 * mirroring how avatar services derive a color from an identity. Reuses the
 * curated palette above; every color is dark enough for white initials.
 */
export function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

/**
 * FNV-1a, 32-bit. Deliberately NOT `avatarColorFor`'s `hash * 31 + c`: with a
 * 10-color palette that one degenerates, because 31 ≡ 1 (mod 10), so the index
 * ends up being the sum of the char codes mod 10 — "courses" and "autres"
 * collide for exactly that reason. The 16777619 multiplier spreads the low bits
 * across the whole word, so the palette index depends on every byte.
 *
 * `avatarColorFor` is left alone on purpose: it already decides the color of
 * every existing avatar, and remixing it would silently recolor people.
 */
function mix32(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * The color to paint a poste's dot with. Two jobs, both of which used to be done
 * (badly) by the `category.color ? … : undefined` ternary repeated at eight call
 * sites:
 *
 * - Validate. A corrupt stored value ("bleu", an old format) produced an invalid
 *   `background` and a dot painted with nothing; now it degrades to the palette.
 * - Give uncolored postes their own hue instead of all sharing `--primary`,
 *   without adding a stored field to migrate.
 *
 * Collisions are still possible — ten colors cannot separate arbitrarily many
 * ids — so this is a nicety, not a guarantee. Nothing may rely on the dot alone
 * to tell two postes apart; that is why every row keeps its poste name in text.
 */
export function posteColor(category: { id: string; color?: string | null }): string {
  if (isHexColor(category.color)) return category.color;
  return CATEGORY_COLORS[mix32(category.id) % CATEGORY_COLORS.length];
}
