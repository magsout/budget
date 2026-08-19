import { describe, expect, it } from "vitest";
import { computeTimeline, monthStateFor, totalRemaining } from "../src/lib/budget.ts";
import {
  apportsTotalIn,
  movementNetFor,
  movementsIn,
  proposeRepartition,
  repartitionDrift,
  repartitionToMovements,
  spreadOverShortfalls,
} from "../src/lib/movements.ts";
import type {
  BudgetMovement,
  BudgetVersion,
  CarryOverride,
  Category,
  Dataset,
  Expense,
} from "../src/lib/types.ts";

function cat(id: string, createdMonth: string, sortOrder = 0): Category {
  return {
    id,
    name: id,
    sortOrder,
    createdAt: `${createdMonth}-01T09:00:00.000Z`,
    archivedAt: null,
  };
}

function ver(categoryId: string, amountCents: number, effectiveFrom: string): BudgetVersion {
  return { id: `${categoryId}-${effectiveFrom}`, categoryId, amountCents, effectiveFrom };
}

function exp(categoryId: string, amountCents: number, date: string): Expense {
  return {
    id: `${categoryId}-${date}-${amountCents}`,
    categoryId,
    userId: "u1",
    amountCents,
    description: null,
    date,
    createdAt: `${date}T12:00:00.000Z`,
    deletedAt: null,
  };
}

function carry(categoryId: string, month: string, carryInCents: number): CarryOverride {
  return {
    id: `${categoryId}_${month}`,
    categoryId,
    month,
    carryInCents,
    createdAt: `${month}-01T09:00:00.000Z`,
  };
}

/** A transfer between two postes: `from` loses, `to` gains, total conserved. */
function transfer(
  from: string,
  to: string,
  month: string,
  amountCents: number,
  over: Partial<BudgetMovement> = {},
): BudgetMovement {
  return {
    id: `mv-${from}-${to}-${month}`,
    month,
    fromCategoryId: from,
    toCategoryId: to,
    fromIncomeId: null,
    amountCents,
    label: null,
    createdAt: `${month}-01T09:00:00.000Z`,
    deletedAt: null,
    ...over,
  };
}

/** An apport: money brought in from outside the postes. */
function apport(
  to: string,
  month: string,
  amountCents: number,
  over: Partial<BudgetMovement> = {},
): BudgetMovement {
  return {
    id: `ap-${to}-${month}`,
    month,
    fromCategoryId: null,
    toCategoryId: to,
    fromIncomeId: "i1",
    amountCents,
    label: null,
    createdAt: `${month}-01T09:00:00.000Z`,
    deletedAt: null,
    ...over,
  };
}

function dataset(over: Partial<Dataset> = {}): Dataset {
  return {
    users: [],
    categories: [],
    budgetVersions: [],
    carryOverrides: [],
    budgetMovements: [],
    expenses: [],
    recurringExpenses: [],
    incomes: [],
    ...over,
  };
}

describe("movementNetFor", () => {
  it("splits apports from transfers — they are not the same story", () => {
    const movements = [apport("c", "2026-09", 15000), transfer("d", "c", "2026-09", 10000)];
    expect(movementNetFor(movements, "c", "2026-09")).toEqual({
      apportCents: 15000,
      transferCents: 10000,
    });
    expect(movementNetFor(movements, "d", "2026-09")).toEqual({
      apportCents: 0,
      transferCents: -10000,
    });
  });

  it("nets both directions when a poste both receives and gives", () => {
    const movements = [transfer("a", "b", "2026-09", 10000), transfer("b", "c", "2026-09", 4000)];
    expect(movementNetFor(movements, "b", "2026-09").transferCents).toBe(6000);
  });

  it("ignores other months and soft-deleted rows", () => {
    const movements = [
      transfer("a", "b", "2026-08", 10000),
      transfer("a", "b", "2026-09", 5000, { id: "x", deletedAt: "2026-09-02T00:00:00.000Z" }),
    ];
    expect(movementNetFor(movements, "b", "2026-09")).toEqual({
      apportCents: 0,
      transferCents: 0,
    });
  });

  it("nets a self-transfer to zero rather than counting it as money in", () => {
    // The UI forbids it, but nothing in the data model does, and a row that
    // credited a poste without debiting it would invent money.
    const movements = [transfer("a", "a", "2026-09", 10000)];
    expect(movementNetFor(movements, "a", "2026-09")).toEqual({
      apportCents: 0,
      transferCents: 0,
    });
  });
});

describe("transfers conserve the total", () => {
  // THE property of the model: moving a report changes who owes it, never how
  // much is owed. If this test ever fails, the books can invent or lose money.
  const base = dataset({
    categories: [cat("courses", "2026-08"), cat("autres", "2026-08", 1)],
    budgetVersions: [ver("courses", 20000, "2026-08"), ver("autres", 40000, "2026-08")],
    expenses: [exp("courses", 30000, "2026-08-10"), exp("autres", 45000, "2026-08-12")],
  });

  it("leaves totalRemaining untouched", () => {
    const without = totalRemaining(base, "2026-09");
    const withTransfer = totalRemaining(
      { ...base, budgetMovements: [transfer("autres", "courses", "2026-09", 10000)] },
      "2026-09",
    );
    expect(withTransfer).toBe(without);
  });
});

describe("the scenario that motivated this: redirect the report onto the less important poste", () => {
  // Courses budget 200 / spent 300 → report −100
  // Autres  budget 400 / spent 450 → report −50
  // Autres matters less than Courses, so September should read 0 and −150.
  const base = dataset({
    categories: [cat("courses", "2026-08"), cat("autres", "2026-08", 1)],
    budgetVersions: [ver("courses", 20000, "2026-08"), ver("autres", 40000, "2026-08")],
    expenses: [exp("courses", 30000, "2026-08-10"), exp("autres", 45000, "2026-08-12")],
  });

  it("folds the untouched reports as −100 and −50", () => {
    expect(monthStateFor(base, "courses", "2026-09")?.carryInCents).toBe(-10000);
    expect(monthStateFor(base, "autres", "2026-09")?.carryInCents).toBe(-5000);
  });

  it("a 100 € transfer from autres to courses leaves 0 and −150 in effect", () => {
    const ds = { ...base, budgetMovements: [transfer("autres", "courses", "2026-09", 10000)] };

    const courses = monthStateFor(ds, "courses", "2026-09");
    // The report itself is untouched — the overspend stays on the record — and
    // the transfer is what brings the available budget back to the full 200 €.
    expect(courses?.carryInCents).toBe(-10000);
    expect(courses?.transferCents).toBe(10000);
    expect(courses?.startingCents).toBe(20000);

    const autres = monthStateFor(ds, "autres", "2026-09");
    expect(autres?.carryInCents).toBe(-5000);
    expect(autres?.transferCents).toBe(-10000);
    expect(autres?.startingCents).toBe(25000); // 400 − 150
  });

  it("keeps the debt moved in October — the decision is taken once, not monthly", () => {
    const ds = { ...base, budgetMovements: [transfer("autres", "courses", "2026-09", 10000)] };
    // Nothing spent in September, so each poste carries its adjusted balance on.
    expect(monthStateFor(ds, "courses", "2026-10")?.carryInCents).toBe(20000);
    expect(monthStateFor(ds, "autres", "2026-10")?.carryInCents).toBe(25000);
    // And the total is still conserved across the two.
    expect(totalRemaining(ds, "2026-10")).toBe(totalRemaining(base, "2026-10"));
  });
});

describe("apports", () => {
  const base = dataset({
    categories: [cat("courses", "2026-08")],
    budgetVersions: [ver("courses", 40000, "2026-08")],
    expenses: [exp("courses", 60000, "2026-08-10")], // report −200
  });

  it("lifts the available budget and lets the shortfall roll on", () => {
    const ds = { ...base, budgetMovements: [apport("courses", "2026-09", 15000)] };
    const sept = monthStateFor(ds, "courses", "2026-09");
    expect(sept?.carryInCents).toBe(-20000); // the hole is still on the record
    expect(sept?.apportCents).toBe(15000);
    expect(sept?.startingCents).toBe(35000); // 400 − 200 + 150
    expect(sept?.remainingCents).toBe(35000);

    // Only partly covered? The residual keeps folding, exactly as before.
    const partly = {
      ...base,
      budgetMovements: [apport("courses", "2026-09", 15000)],
      expenses: [...base.expenses, exp("courses", 40000, "2026-09-05")],
    };
    expect(monthStateFor(partly, "courses", "2026-09")?.remainingCents).toBe(-5000);
    expect(monthStateFor(partly, "courses", "2026-10")?.carryInCents).toBe(-5000);
  });

  it("raises the grand total, unlike a transfer — real money came in", () => {
    const ds = { ...base, budgetMovements: [apport("courses", "2026-09", 15000)] };
    expect(totalRemaining(ds, "2026-09") - totalRemaining(base, "2026-09")).toBe(15000);
  });

  it("apportsTotalIn counts only money from outside", () => {
    const ds = dataset({
      budgetMovements: [
        apport("courses", "2026-09", 15000),
        transfer("autres", "courses", "2026-09", 10000),
        apport("essence", "2026-08", 9999),
      ],
    });
    expect(apportsTotalIn(ds, "2026-09")).toBe(15000);
  });
});

describe("movements and carry overrides coexist", () => {
  it("applies the movement on top of the forced carry-in", () => {
    // Two different tools: the override forgives a debt, the movement moves it.
    // Neither cancels the other.
    const ds = dataset({
      categories: [cat("courses", "2026-08")],
      budgetVersions: [ver("courses", 40000, "2026-08")],
      expenses: [exp("courses", 60000, "2026-08-10")],
      carryOverrides: [carry("courses", "2026-09", 0)],
      budgetMovements: [apport("courses", "2026-09", 15000)],
    });
    const sept = monthStateFor(ds, "courses", "2026-09");
    expect(sept?.carryInCents).toBe(0);
    expect(sept?.carryAdjusted).toBe(true);
    expect(sept?.apportCents).toBe(15000);
    expect(sept?.startingCents).toBe(55000); // 400 + 0 + 150
  });
});

describe("a movement opens the timeline", () => {
  it("starts the fold at a month that has nothing else in it", () => {
    const ds = dataset({
      categories: [cat("courses", "2026-08")],
      budgetVersions: [ver("courses", 10000, "2026-08")],
      budgetMovements: [apport("courses", "2026-06", 5000)],
    });
    const timeline = computeTimeline(ds, "courses", "2026-08");
    expect(timeline.map((r) => r.month)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(timeline[0].apportCents).toBe(5000);
  });
});

describe("soft delete", () => {
  it("refolds the balances as if the movement had never happened", () => {
    const base = dataset({
      categories: [cat("courses", "2026-09"), cat("autres", "2026-09", 1)],
      budgetVersions: [ver("courses", 20000, "2026-09"), ver("autres", 40000, "2026-09")],
    });
    const live = {
      ...base,
      budgetMovements: [transfer("autres", "courses", "2026-09", 10000)],
    };
    const dead = {
      ...base,
      budgetMovements: [
        transfer("autres", "courses", "2026-09", 10000, {
          deletedAt: "2026-09-05T10:00:00.000Z",
        }),
      ],
    };
    expect(monthStateFor(live, "courses", "2026-09")?.startingCents).toBe(30000);
    expect(monthStateFor(dead, "courses", "2026-09")?.startingCents).toBe(20000);
  });

  it("drops deleted rows from the month's list", () => {
    const ds = dataset({
      budgetMovements: [
        apport("courses", "2026-09", 15000),
        transfer("autres", "essence", "2026-09", 1000, { id: "gone", deletedAt: "2026-09-09" }),
      ],
    });
    expect(movementsIn(ds, "2026-09").map((m) => m.id)).toEqual(["ap-courses-2026-09"]);
  });
});

const rows = (...pairs: [string, number][]) =>
  pairs.map(([categoryId, carryInCents]) => ({
    categoryId,
    carryInCents,
    adjustedCents: carryInCents,
  }));

describe("proposeRepartition", () => {
  it("pulls the important poste out of the red, drawing from the last", () => {
    // The motivating case: courses first (protected), autres last (absorbs).
    const out = proposeRepartition(rows(["courses", -10000], ["autres", -5000]));
    expect(out.map((r) => [r.categoryId, r.adjustedCents])).toEqual([
      ["courses", 0],
      ["autres", -15000],
    ]);
  });

  it("conserves the total, always", () => {
    const cases = [
      rows(["a", -10000], ["b", -5000]),
      rows(["a", -10000], ["b", 20000], ["c", -3000]),
      rows(["a", 5000], ["b", 5000]),
      rows(["a", -50000], ["b", 100], ["c", 200]),
    ];
    for (const input of cases) {
      const before = input.reduce((s, r) => s + r.carryInCents, 0);
      const after = proposeRepartition(input).reduce((s, r) => s + r.adjustedCents, 0);
      expect(after).toBe(before);
    }
  });

  it("draws on a poste in credit before pushing debt down the list", () => {
    const out = proposeRepartition(rows(["courses", -10000], ["epargne", 30000]));
    expect(out.map((r) => r.adjustedCents)).toEqual([0, 20000]);
  });

  it("leaves nothing red above the last poste", () => {
    const out = proposeRepartition(rows(["a", -1000], ["b", -2000], ["c", -3000]));
    expect(out.slice(0, -1).every((r) => r.adjustedCents >= 0)).toBe(true);
    expect(out.at(-1)?.adjustedCents).toBe(-6000);
  });

  it("does not touch a set that is already all in the black", () => {
    const input = rows(["a", 1000], ["b", 2000]);
    expect(proposeRepartition(input).map((r) => r.adjustedCents)).toEqual([1000, 2000]);
  });
});

describe("repartitionToMovements", () => {
  it("realises the motivating case as one transfer", () => {
    const movements = repartitionToMovements(
      [
        { categoryId: "courses", carryInCents: -10000, adjustedCents: 0 },
        { categoryId: "autres", carryInCents: -5000, adjustedCents: -15000 },
      ],
      "2026-09",
    );
    expect(movements).toEqual([
      { month: "2026-09", fromCategoryId: "autres", toCategoryId: "courses", amountCents: 10000 },
    ]);
  });

  it("produces nothing for an untouched repartition", () => {
    expect(
      repartitionToMovements(
        [{ categoryId: "a", carryInCents: -10000, adjustedCents: -10000 }],
        "2026-09",
      ),
    ).toEqual([]);
  });

  it("splits one giver across several takers", () => {
    const movements = repartitionToMovements(
      [
        { categoryId: "a", carryInCents: -3000, adjustedCents: 0 },
        { categoryId: "b", carryInCents: -2000, adjustedCents: 0 },
        { categoryId: "c", carryInCents: 5000, adjustedCents: 0 },
      ],
      "2026-09",
    );
    expect(movements.map((m) => [m.fromCategoryId, m.toCategoryId, m.amountCents])).toEqual([
      ["c", "a", 3000],
      ["c", "b", 2000],
    ]);
  });

  it("emits movements whose net exactly reproduces the intended adjustment", () => {
    // The guarantee that matters: whatever the UI produced, applying the
    // movements lands on the numbers the user validated.
    const intended = [
      { categoryId: "a", carryInCents: -10000, adjustedCents: 2000 },
      { categoryId: "b", carryInCents: 8000, adjustedCents: -1000 },
      { categoryId: "c", carryInCents: 5000, adjustedCents: 2000 },
    ];
    const movements = repartitionToMovements(intended, "2026-09");
    for (const row of intended) {
      const net = movements.reduce(
        (s, m) =>
          s +
          (m.toCategoryId === row.categoryId ? m.amountCents : 0) -
          (m.fromCategoryId === row.categoryId ? m.amountCents : 0),
        0,
      );
      expect(row.carryInCents + net).toBe(row.adjustedCents);
    }
  });
});

describe("repartitionDrift", () => {
  it("is zero for a balanced repartition and signed otherwise", () => {
    expect(
      repartitionDrift([
        { categoryId: "a", carryInCents: -10000, adjustedCents: 0 },
        { categoryId: "b", carryInCents: -5000, adjustedCents: -15000 },
      ]),
    ).toBe(0);
    expect(repartitionDrift([{ categoryId: "a", carryInCents: -10000, adjustedCents: 0 }])).toBe(
      10000,
    );
  });
});

describe("spreadOverShortfalls", () => {
  const needy = [
    { categoryId: "a", shortfallCents: 30000 },
    { categoryId: "b", shortfallCents: 10000 },
  ];

  it("splits the pot proportionally to the depth of each hole", () => {
    expect(spreadOverShortfalls(needy, 20000)).toEqual([
      { categoryId: "a", amountCents: 15000 },
      { categoryId: "b", amountCents: 5000 },
    ]);
  });

  it("adds up to exactly the pot, cents included", () => {
    for (const pot of [1, 7, 33, 101, 9999, 39999]) {
      const parts = spreadOverShortfalls(needy, pot);
      expect(parts.reduce((s, p) => s + p.amountCents, 0)).toBe(pot);
    }
  });

  it("never gives a poste more than it needs", () => {
    // A pot bigger than the total shortfall fills the holes and stops; the
    // excess is left for the user to place rather than inflating budgets.
    const parts = spreadOverShortfalls(needy, 100000);
    expect(parts).toEqual([
      { categoryId: "a", amountCents: 30000 },
      { categoryId: "b", amountCents: 10000 },
    ]);
  });

  it("ignores postes in the black, and an empty or absent pot", () => {
    expect(spreadOverShortfalls([{ categoryId: "a", shortfallCents: -500 }], 10000)).toEqual([]);
    expect(spreadOverShortfalls(needy, 0)).toEqual([]);
  });
});
