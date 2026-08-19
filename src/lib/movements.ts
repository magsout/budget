import type { MonthKey } from "./dates.ts";
import { largestRemainder, share } from "./shape.ts";
import type { BudgetMovement, Dataset } from "./types.ts";

/**
 * What movements did to one poste in one month, split in two because the two
 * halves do not tell the same story: "someone brought me money" is not
 * "someone moved my debt onto me". The Dashboard words them differently and the
 * Compte tab only deducts the first, so the fold keeps them apart.
 */
export interface MovementNet {
  /** Received from outside the postes (a one-off income). Always >= 0. */
  apportCents: number;
  /** Net of report reallocations between postes. Signed: in − out. */
  transferCents: number;
}

/**
 * Net effect of `month`'s movements on one poste, in a single pass over the
 * list — same shape as `spentForCategoryMonth`, and the volume is tiny.
 *
 * A poste can be both source and target in the same month (money in from one
 * neighbour, out to another), so both sides are always summed; only their net
 * reaches the fold.
 */
export function movementNetFor(
  movements: BudgetMovement[],
  categoryId: string,
  month: MonthKey,
): MovementNet {
  let apportCents = 0;
  let transferCents = 0;
  for (const m of movements) {
    if (m.deletedAt) continue;
    if (m.month !== month) continue;
    if (m.toCategoryId === categoryId) {
      if (m.fromCategoryId === null) apportCents += m.amountCents;
      else transferCents += m.amountCents;
    }
    // Not an `else if`: a movement never has the same poste on both ends (the
    // UI forbids it), but nothing in the data model enforces it, and a
    // self-transfer must net to zero rather than double-count as income.
    if (m.fromCategoryId === categoryId) transferCents -= m.amountCents;
  }
  return { apportCents, transferCents };
}

/** Non-deleted movements of a month, most recent first. */
export function movementsIn(dataset: Dataset, month: MonthKey): BudgetMovement[] {
  return dataset.budgetMovements
    .filter((m) => !m.deletedAt && m.month === month)
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Total brought into the postes from outside in `month` — the slice of income
 * that has been assigned to budgets on top of their monthly allocation. This is
 * what the Compte tab deducts so a bonus spent plugging holes stops reading as
 * money still available.
 */
export function apportsTotalIn(dataset: Dataset, month: MonthKey): number {
  let total = 0;
  for (const m of dataset.budgetMovements) {
    if (m.deletedAt) continue;
    if (m.month !== month) continue;
    if (m.fromCategoryId === null) total += m.amountCents;
  }
  return total;
}

/** One poste as the repartition screen sees it. */
export interface RepartitionRow {
  categoryId: string;
  /** The report the fold produced on its own, before any movement. */
  carryInCents: number;
  /** Where the user wants it — equal to `carryInCents` until they move it. */
  adjustedCents: number;
}

/**
 * Propose a redistribution: pull the postes out of the red, drawing from the
 * postes furthest down the list. The LAST poste is the exception — it is where the
 * shortfall is gathered, so it is the one row that can still be negative after.
 *
 * `rows` must arrive in priority order (most important first) — the caller
 * passes them in `sortOrder`, the order the ↑↓ arrows in Réglages already
 * define, rather than inventing a second notion of importance the user would
 * have to maintain separately.
 *
 * Conserves the total exactly: it only ever moves what it takes. When the
 * overdrafts outweigh what the lower postes can absorb, the remainder is left on
 * the last poste rather than silently dropped — a proposal that balanced by
 * balanced itself by losing money would be worse than one that admits the hole.
 *
 * Generic in the row type so callers keep their own fields (the screen carries a
 * category and the raw field text on each row) without a cast.
 */
export function proposeRepartition<T extends RepartitionRow>(rows: T[]): T[] {
  const out = rows.map((r) => ({ ...r, adjustedCents: r.carryInCents }));

  // Walk the priority order; each poste in the red pulls from the tail upward.
  for (let i = 0; i < out.length; i++) {
    let need = -out[i].adjustedCents;
    if (need <= 0) continue;
    for (let j = out.length - 1; j > i && need > 0; j--) {
      const spare = out[j].adjustedCents;
      if (spare <= 0) continue;
      const taken = Math.min(spare, need);
      out[j].adjustedCents -= taken;
      out[i].adjustedCents += taken;
      need -= taken;
    }
    // Nothing left to draw on below: no later row can do better either, so stop
    // scanning. Whatever is still red is gathered onto the last poste just after.
    if (need > 0) break;
  }

  // Whatever red remains goes to the least important poste. That is the point of
  // the gesture: ONE poste carries the shortfall instead of all of them sharing it.
  const last = out.length - 1;
  for (let i = 0; i < last; i++) {
    if (out[i].adjustedCents >= 0) continue;
    out[last].adjustedCents += out[i].adjustedCents;
    out[i].adjustedCents = 0;
  }

  return out;
}

/**
 * Turn an adjusted repartition into the movements that realise it.
 *
 * Postes that gained are matched against postes that gave, greedily. The result
 * is balanced by construction — it is derived from differences that sum to zero,
 * so no combination of inputs can mint money. Rows the user did not touch
 * produce nothing.
 */
export function repartitionToMovements(
  rows: RepartitionRow[],
  month: MonthKey,
): { fromCategoryId: string; toCategoryId: string; amountCents: number; month: MonthKey }[] {
  const givers = rows
    .map((r) => ({ id: r.categoryId, left: r.carryInCents - r.adjustedCents }))
    .filter((r) => r.left > 0);
  const takers = rows
    .map((r) => ({ id: r.categoryId, want: r.adjustedCents - r.carryInCents }))
    .filter((r) => r.want > 0);

  const movements = [];
  let g = 0;
  for (const taker of takers) {
    let want = taker.want;
    while (want > 0 && g < givers.length) {
      const giver = givers[g];
      if (giver.left <= 0) {
        g++;
        continue;
      }
      const amountCents = Math.min(giver.left, want);
      movements.push({
        month,
        fromCategoryId: giver.id,
        toCategoryId: taker.id,
        amountCents,
      });
      giver.left -= amountCents;
      want -= amountCents;
    }
  }
  return movements;
}

/** How far a repartition is from conserving the total. Zero means balanced. */
export function repartitionDrift(rows: RepartitionRow[]): number {
  return rows.reduce((sum, r) => sum + r.adjustedCents - r.carryInCents, 0);
}

/**
 * Spread a pot across the postes in the red, proportionally to how deep each one
 * is. Largest remainder, so the parts add up to exactly `potCents` instead of
 * losing a cent or two to rounding — the same reasoning as `stackWidths`.
 *
 * Never gives a poste more than it needs: a pot bigger than the total shortfall
 * leaves the excess unallocated for the user to place, rather than inflating
 * budgets nobody asked to inflate.
 */
export function spreadOverShortfalls(
  shortfalls: { categoryId: string; shortfallCents: number }[],
  potCents: number,
): { categoryId: string; amountCents: number }[] {
  const needy = shortfalls.filter((s) => s.shortfallCents > 0);
  const total = needy.reduce((s, n) => s + n.shortfallCents, 0);
  if (total <= 0 || potCents <= 0) return [];

  // Enough to cover everything: no proportion to compute, just fill the holes.
  if (potCents >= total) {
    return needy.map((n) => ({ categoryId: n.categoryId, amountCents: n.shortfallCents }));
  }

  const exact = needy.map((n) => share(n.shortfallCents, total) * potCents);
  return largestRemainder(exact, potCents)
    .map((amountCents, i) => ({ categoryId: needy[i].categoryId, amountCents }))
    .filter((p) => p.amountCents > 0);
}

/**
 * The transfers a repartition of `month` replaces: every poste-to-poste movement
 * of that month. `RepartitionSection` regenerates the whole set from a
 * movement-free baseline, so re-validating it must retire all of them.
 */
export function transfersToReplace(dataset: Dataset, month: MonthKey): BudgetMovement[] {
  return movementsIn(dataset, month).filter((m) => m.fromCategoryId !== null);
}

/**
 * The apports a placement of `incomeId` replaces — that pot's apports for the
 * month, and ONLY that pot's.
 *
 * Scoped by pot, not merely by "is an apport": the screen lets you switch between
 * one-off incomes, so retiring every apport of the month would make placing a
 * second bonus silently erase the first one's. That makes `fromIncomeId` part of
 * the identity of a placement rather than the decoration its doc comment calls it.
 */
export function apportsToReplace(
  dataset: Dataset,
  month: MonthKey,
  incomeId: string,
): BudgetMovement[] {
  return movementsIn(dataset, month).filter(
    (m) => m.fromCategoryId === null && m.fromIncomeId === incomeId,
  );
}
