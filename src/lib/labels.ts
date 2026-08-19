import type { MonthState } from "./budget.ts";
import { formatCents } from "./money.ts";

/**
 * How a month's report reads on screen, or null when there is nothing to say
 * (no carry-over, and none was forced). Kept here so the dashboard, the history
 * and the settings all word a reset the same way.
 */
export function carryLabel(
  state: Pick<MonthState, "carryInCents" | "carryAdjusted">,
): string | null {
  if (state.carryAdjusted && state.carryInCents === 0) return "Report ignoré";
  if (state.carryInCents === 0) return null;
  return `Report ${formatCents(state.carryInCents)}${state.carryAdjusted ? " (ajusté)" : ""}`;
}

/** How a remaining balance is coloured. Maps to the `.positive` / `.warning` / `.negative` classes. */
export type Tone = "positive" | "warning" | "negative";

/**
 * The tone a poste's remaining balance is shown in: overdrawn, nearly out (under
 * 15% of what was available), or fine.
 *
 * Lives here, next to `carryLabel`, for the same reason: the Budget tab and the
 * Historique tab must describe the same state identically. They did not — this
 * was a private helper on the dashboard, and the history had its own
 * `remaining < 0` version with no warning threshold at all, so the same poste
 * could read amber on one screen and green on the other.
 */
export function remainingTone(remainingCents: number, startingCents: number): Tone {
  if (remainingCents < 0) return "negative";
  if (startingCents > 0 && remainingCents < startingCents * 0.15) return "warning";
  return "positive";
}

/**
 * Where a poste's available budget came from, in ONE clause.
 *
 * The Dashboard meta line already reads "spent / available · report". Movements
 * would make it a fourth item, and at 390px a third "·" crushes the figures —
 * the same crowding the Compte cascade was built to fix. So report and movements
 * are composed here into a single phrase, and the full four-term breakdown lives
 * on the repartition screen, whose whole job is to explain it.
 */
export function originLabel(state: MonthState): string | null {
  const moved = state.transferCents;
  const given = state.apportCents;
  const report = carryLabel(state);

  const parts: string[] = [];
  if (report) parts.push(report);
  if (given !== 0) parts.push(`apport ${formatCents(given)}`);
  if (moved !== 0)
    parts.push(moved > 0 ? `reçu ${formatCents(moved)}` : `cédé ${formatCents(-moved)}`);

  if (parts.length === 0) return null;
  // Two clauses is the ceiling. Past that, name the net rather than enumerate:
  // the reader wants to know the budget was adjusted, not by which three routes.
  if (parts.length > 2) {
    const net = given + moved;
    return `${report ?? "Report"} · ajusté de ${formatCents(net)}`;
  }
  return parts.join(" · ");
}
