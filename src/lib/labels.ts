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
