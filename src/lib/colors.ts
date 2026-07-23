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
