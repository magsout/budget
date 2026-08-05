import type { User } from "./types.ts";

/**
 * The people still offered in the pickers. Retiring someone hides them from new
 * expenses without touching the past: lookups by id go through the full
 * `dataset.users`, so old expenses keep showing their author's name.
 */
export function activeUsers(users: User[]): User[] {
  return users.filter((u) => !u.archivedAt);
}
