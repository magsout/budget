/**
 * A deterministic dataset for the fixture harness and the e2e smoke tests.
 * Dates are anchored to the CURRENT month so the Budget tab (which always shows
 * `currentMonth()`) has content whenever it runs.
 *
 * It deliberately covers the awkward cases: an archived poste, a hand-set
 * report, a soft-deleted expense, and two people.
 */
import { currentMonth, prevMonth } from "../lib/dates.ts";
import type { Dataset, Expense } from "../lib/types.ts";

const M = currentMonth();
const PREV = prevMonth(M);
/** Two months back: inside the "frequent" window, outside the months the e2e counts assert on. */
const PREV2 = prevMonth(PREV);

function expense(
  id: string,
  categoryId: string,
  amountCents: number,
  day: string,
  userId: string,
  description: string | null,
  deletedAt: string | null = null,
  month: string = M,
): Expense {
  return {
    id,
    categoryId,
    userId,
    amountCents,
    description,
    date: `${month}-${day}`,
    createdAt: `${month}-${day}T12:00:00.000Z`,
    deletedAt,
  };
}

export const FIXTURE_DATASET: Dataset = {
  users: [
    { id: "u1", firstName: "Guillaume", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "u2", firstName: "Marie", createdAt: "2026-01-01T00:00:00.000Z" },
    {
      id: "u3",
      firstName: "Colocataire",
      createdAt: "2026-01-01T00:00:00.000Z",
      archivedAt: `${PREV}-20T10:00:00.000Z`,
    },
  ],
  categories: [
    {
      id: "courses",
      name: "Courses",
      sortOrder: 0,
      color: "#16a34a",
      createdAt: "2026-01-01T00:00:00.000Z",
      archivedAt: null,
    },
    {
      id: "loisirs",
      name: "Loisirs",
      sortOrder: 1,
      color: "#7c3aed",
      createdAt: "2026-01-01T00:00:00.000Z",
      archivedAt: null,
    },
    {
      id: "essence",
      name: "Essence",
      sortOrder: 2,
      color: "#ea580c",
      createdAt: "2026-01-01T00:00:00.000Z",
      archivedAt: null,
    },
    {
      id: "maison",
      name: "Maison & jardin",
      sortOrder: 3,
      color: "#0891b2",
      createdAt: "2026-01-01T00:00:00.000Z",
      archivedAt: null,
    },
    {
      id: "vacances",
      name: "Vacances",
      sortOrder: 4,
      color: "#db2777",
      createdAt: "2026-01-01T00:00:00.000Z",
      archivedAt: `${PREV}-15T10:00:00.000Z`,
    },
  ],
  budgetVersions: [
    { id: "v1", categoryId: "courses", amountCents: 65000, effectiveFrom: "2026-01" },
    { id: "v2", categoryId: "loisirs", amountCents: 20000, effectiveFrom: "2026-01" },
    { id: "v3", categoryId: "essence", amountCents: 15000, effectiveFrom: "2026-01" },
    { id: "v4", categoryId: "maison", amountCents: 10000, effectiveFrom: "2026-01" },
    { id: "v5", categoryId: "vacances", amountCents: 30000, effectiveFrom: "2026-01" },
  ],
  // Loisirs was reset this month — renders as "Report ignoré".
  carryOverrides: [
    { id: "o1", categoryId: "loisirs", month: M, carryInCents: 0, createdAt: "2026-01-01" },
  ],
  expenses: [
    expense("e1", "courses", 4250, "02", "u1", "Marché"),
    expense("e2", "courses", 8790, "04", "u2", null),
    expense("e3", "loisirs", 2400, "05", "u1", "Cinéma"),
    expense("e4", "essence", 6510, "06", "u2", "Plein"),
    expense("e5", "courses", 3120, "07", "u1", null),
    expense("e6", "loisirs", 1800, "08", "u2", "Erreur", `${M}-09T08:00:00.000Z`),
    // Last month, so the Historique tab and the per-poste trend have content.
    expense("p1", "courses", 51200, "05", "u1", "Grosses courses", null, PREV),
    expense("p2", "courses", 12300, "18", "u2", null, null, PREV),
    expense("p3", "essence", 7100, "12", "u1", "Plein", null, PREV),
    expense("p4", "loisirs", 24500, "22", "u2", "Restaurant", null, PREV),
    // A repeated combination, so the expense form has a "Fréquent" shortcut.
    expense("h1", "courses", 650, "03", "u1", "Boulangerie", null, PREV2),
    expense("h2", "courses", 650, "11", "u1", "Boulangerie", null, PREV2),
    expense("h3", "courses", 650, "24", "u2", "Boulangerie", null, PREV2),
  ],
  recurringExpenses: [
    {
      id: "r1",
      name: "Loyer",
      amountCents: 120000,
      description: null,
      startMonth: null,
      endMonth: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    },
  ],
  incomes: [
    {
      id: "i1",
      name: "Salaire",
      amountCents: 250000,
      description: null,
      startMonth: null,
      endMonth: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    },
  ],
};
