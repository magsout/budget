import { describe, expect, it } from "vitest";
import {
  budgetVersionFor,
  carryOverrideFor,
  categoriesActiveIn,
  categoryExpenseCounts,
  computeTimeline,
  deletedExpenses,
  expensesForMonth,
  monthStateFor,
  monthSummary,
  totalRemaining,
} from "../src/lib/budget.ts";
import type { BudgetVersion, CarryOverride, Category, Dataset, Expense } from "../src/lib/types.ts";

function cat(id: string, createdMonth: string, over: Partial<Category> = {}): Category {
  return {
    id,
    name: id,
    sortOrder: 0,
    createdAt: `${createdMonth}-01T09:00:00.000Z`,
    archivedAt: null,
    ...over,
  };
}

function ver(categoryId: string, amountCents: number, effectiveFrom: string): BudgetVersion {
  return { id: `${categoryId}-${effectiveFrom}`, categoryId, amountCents, effectiveFrom };
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

function exp(
  categoryId: string,
  amountCents: number,
  date: string,
  over: Partial<Expense> = {},
): Expense {
  return {
    id: `${categoryId}-${date}-${amountCents}`,
    categoryId,
    userId: "u1",
    amountCents,
    description: null,
    date,
    createdAt: `${date}T12:00:00.000Z`,
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
    expenses: [],
    recurringExpenses: [],
    incomes: [],
    ...over,
  };
}

describe("budgetVersionFor (SCD-2 lookup)", () => {
  const versions = [ver("c", 10000, "2026-06"), ver("c", 20000, "2026-08")];

  it("picks the greatest effectiveFrom <= month", () => {
    expect(budgetVersionFor(versions, "c", "2026-06")).toBe(10000);
    expect(budgetVersionFor(versions, "c", "2026-07")).toBe(10000);
    expect(budgetVersionFor(versions, "c", "2026-08")).toBe(20000);
    expect(budgetVersionFor(versions, "c", "2026-12")).toBe(20000);
  });

  it("returns 0 before any version applies", () => {
    expect(budgetVersionFor(versions, "c", "2026-05")).toBe(0);
    expect(budgetVersionFor(versions, "other", "2026-08")).toBe(0);
  });
});

describe("computeTimeline carryover", () => {
  it("rolls a POSITIVE remaining forward", () => {
    const ds = dataset({
      categories: [cat("courses", "2026-07")],
      budgetVersions: [ver("courses", 65000, "2026-07")],
      expenses: [exp("courses", 60000, "2026-07-10")],
    });
    const tl = computeTimeline(ds, "courses", "2026-08");
    expect(tl[0]).toMatchObject({
      month: "2026-07",
      startingCents: 65000,
      spentCents: 60000,
      remainingCents: 5000,
    });
    expect(tl[1]).toMatchObject({
      month: "2026-08",
      carryInCents: 5000,
      startingCents: 70000,
      remainingCents: 70000,
    });
  });

  it("rolls a NEGATIVE remaining forward (symmetric, unlike YNAB)", () => {
    const ds = dataset({
      categories: [cat("loisirs", "2026-07")],
      budgetVersions: [ver("loisirs", 40000, "2026-07")],
      expenses: [exp("loisirs", 45000, "2026-07-20")],
    });
    const tl = computeTimeline(ds, "loisirs", "2026-08");
    expect(tl[0].remainingCents).toBe(-5000);
    expect(tl[1]).toMatchObject({
      carryInCents: -5000,
      startingCents: 35000,
      remainingCents: 35000,
    });
  });

  it("accumulates budget across SKIPPED (empty) months", () => {
    const ds = dataset({
      categories: [cat("essence", "2026-06")],
      budgetVersions: [ver("essence", 10000, "2026-06")],
      expenses: [],
    });
    const tl = computeTimeline(ds, "essence", "2026-09");
    expect(tl.map((r) => r.remainingCents)).toEqual([10000, 20000, 30000, 40000]);
  });

  it("back-dated expense shifts its month AND every later month", () => {
    const base = {
      categories: [cat("c", "2026-06")],
      budgetVersions: [ver("c", 10000, "2026-06")],
    };
    const without = computeTimeline(dataset(base), "c", "2026-08");
    expect(without.map((r) => r.remainingCents)).toEqual([10000, 20000, 30000]);

    const withBackdated = computeTimeline(
      dataset({ ...base, expenses: [exp("c", 3000, "2026-06-15")] }),
      "c",
      "2026-08",
    );
    expect(withBackdated.map((r) => r.remainingCents)).toEqual([7000, 17000, 27000]);
  });

  it("applies a versioned budget change from its effective month only", () => {
    const ds = dataset({
      categories: [cat("c", "2026-06")],
      budgetVersions: [ver("c", 10000, "2026-06"), ver("c", 20000, "2026-08")],
    });
    const tl = computeTimeline(ds, "c", "2026-08");
    expect(tl[0]).toMatchObject({ month: "2026-06", initialCents: 10000, remainingCents: 10000 });
    expect(tl[1]).toMatchObject({ month: "2026-07", initialCents: 10000, remainingCents: 20000 });
    expect(tl[2]).toMatchObject({
      month: "2026-08",
      initialCents: 20000,
      startingCents: 40000,
      remainingCents: 40000,
    });
  });

  it("ignores soft-deleted expenses", () => {
    const ds = dataset({
      categories: [cat("c", "2026-07")],
      budgetVersions: [ver("c", 10000, "2026-07")],
      expenses: [exp("c", 4000, "2026-07-05", { deletedAt: "2026-07-06T00:00:00.000Z" })],
    });
    expect(monthStateFor(ds, "c", "2026-07")?.remainingCents).toBe(10000);
  });

  it("starts the timeline at a back-dated expense before the category's creation month", () => {
    const ds = dataset({
      categories: [cat("c", "2026-07")],
      budgetVersions: [ver("c", 10000, "2026-07")],
      // expense dated before creation and before any budget version -> initial 0 that month
      expenses: [exp("c", 2000, "2026-05-10")],
    });
    const tl = computeTimeline(ds, "c", "2026-07");
    expect(tl[0]).toMatchObject({
      month: "2026-05",
      initialCents: 0,
      spentCents: 2000,
      remainingCents: -2000,
    });
    expect(tl[tl.length - 1]).toMatchObject({
      month: "2026-07",
      carryInCents: -2000,
      remainingCents: 8000,
    });
  });
});

describe("carry overrides", () => {
  const base = {
    categories: [cat("c", "2026-06")],
    budgetVersions: [ver("c", 10000, "2026-06")],
    expenses: [exp("c", 4000, "2026-06-10")],
  };

  it("carryOverrideFor matches on category AND month", () => {
    const overrides = [carry("c", "2026-07", 0), carry("other", "2026-07", 5000)];
    expect(carryOverrideFor(overrides, "c", "2026-07")).toBe(0);
    expect(carryOverrideFor(overrides, "c", "2026-08")).toBeNull();
    expect(carryOverrideFor(overrides, "nope", "2026-07")).toBeNull();
  });

  it("a zero override drops the previous month's leftover", () => {
    // Without it: June leaves 60 -> July starts at 100 + 60.
    const auto = computeTimeline(dataset(base), "c", "2026-07");
    expect(auto[1]).toMatchObject({ carryInCents: 6000, startingCents: 16000 });

    const reset = computeTimeline(
      dataset({ ...base, carryOverrides: [carry("c", "2026-07", 0)] }),
      "c",
      "2026-07",
    );
    expect(reset[1]).toMatchObject({
      carryInCents: 0,
      carryAdjusted: true,
      startingCents: 10000,
      remainingCents: 10000,
    });
  });

  it("wipes an overdraft too (reset is symmetric)", () => {
    const ds = dataset({
      categories: [cat("c", "2026-06")],
      budgetVersions: [ver("c", 10000, "2026-06")],
      expenses: [exp("c", 15000, "2026-06-10")],
      carryOverrides: [carry("c", "2026-07", 0)],
    });
    const tl = computeTimeline(ds, "c", "2026-07");
    expect(tl[0].remainingCents).toBe(-5000);
    expect(tl[1]).toMatchObject({ carryInCents: 0, remainingCents: 10000 });
  });

  it("a non-zero override forces an arbitrary report", () => {
    const tl = computeTimeline(
      dataset({ ...base, carryOverrides: [carry("c", "2026-07", 2500)] }),
      "c",
      "2026-07",
    );
    expect(tl[1]).toMatchObject({ carryInCents: 2500, startingCents: 12500 });
  });

  it("leaves earlier months untouched and resumes folding after", () => {
    const tl = computeTimeline(
      dataset({ ...base, carryOverrides: [carry("c", "2026-07", 0)] }),
      "c",
      "2026-09",
    );
    expect(tl.map((r) => r.carryInCents)).toEqual([0, 0, 10000, 20000]);
    expect(tl.map((r) => r.carryAdjusted)).toEqual([false, true, false, false]);
    expect(tl[0].remainingCents).toBe(6000); // June unchanged
  });

  it("applies on the first month of a timeline", () => {
    const tl = computeTimeline(
      dataset({ ...base, carryOverrides: [carry("c", "2026-06", 3000)] }),
      "c",
      "2026-06",
    );
    expect(tl[0]).toMatchObject({ carryInCents: 3000, startingCents: 13000 });
  });

  it("an override on an otherwise empty month opens the timeline there", () => {
    const ds = dataset({
      categories: [cat("c", "2026-07")],
      budgetVersions: [ver("c", 10000, "2026-07")],
      carryOverrides: [carry("c", "2026-05", 2000)],
    });
    const tl = computeTimeline(ds, "c", "2026-07");
    expect(tl[0]).toMatchObject({ month: "2026-05", carryInCents: 2000, remainingCents: 2000 });
  });

  it("flows through monthSummary and totalRemaining", () => {
    const ds = dataset({ ...base, carryOverrides: [carry("c", "2026-07", 0)] });
    expect(monthStateFor(ds, "c", "2026-07")?.remainingCents).toBe(10000);
    expect(monthSummary(ds, "2026-07")[0].state.carryAdjusted).toBe(true);
    expect(totalRemaining(ds, "2026-07")).toBe(10000);
  });
});

describe("monthSummary & active categories", () => {
  const ds = dataset({
    categories: [
      cat("courses", "2026-06", { sortOrder: 1 }),
      cat("loisirs", "2026-06", { sortOrder: 2 }),
      cat("old", "2026-01", { sortOrder: 3, archivedAt: "2026-05-01T00:00:00.000Z" }),
      cat("future", "2026-09", { sortOrder: 4 }),
    ],
    budgetVersions: [
      ver("courses", 65000, "2026-06"),
      ver("loisirs", 40000, "2026-06"),
      ver("old", 5000, "2026-01"),
      ver("future", 10000, "2026-09"),
    ],
    expenses: [exp("courses", 15000, "2026-07-03")],
  });

  it("excludes not-yet-created and already-archived categories", () => {
    const active = categoriesActiveIn(ds, "2026-07")
      .map((c) => c.id)
      .toSorted();
    expect(active).toEqual(["courses", "loisirs"]);
  });

  it("includes an archived category in a month before it was archived", () => {
    const active = categoriesActiveIn(ds, "2026-04").map((c) => c.id);
    expect(active).toContain("old");
  });

  it("summarizes active categories in sort order with correct remaining", () => {
    const summary = monthSummary(ds, "2026-07");
    expect(summary.map((s) => s.category.id)).toEqual(["courses", "loisirs"]);
    // courses: 650 + (650-150 carry from June=650) ... June rem 650, July start 1300 - 150 = 1150
    expect(summary[0].state.remainingCents).toBe(115000);
    expect(summary[1].state.remainingCents).toBe(80000);
  });

  it("totalRemaining sums active categories", () => {
    expect(totalRemaining(ds, "2026-07")).toBe(115000 + 80000);
  });
});

describe("deletedExpenses (corbeille)", () => {
  it("keeps only soft-deleted rows, most recently deleted first", () => {
    const ds = dataset({
      expenses: [
        exp("c", 1000, "2026-07-01"),
        exp("c", 2000, "2026-07-02", { deletedAt: "2026-07-05T10:00:00.000Z" }),
        exp("c", 3000, "2026-07-03", { deletedAt: "2026-07-09T10:00:00.000Z" }),
      ],
    });
    expect(deletedExpenses(ds).map((e) => e.amountCents)).toEqual([3000, 2000]);
  });

  it("orders by deletion time, not by expense date", () => {
    const ds = dataset({
      expenses: [
        // The OLDER expense was deleted LAST, so it comes first.
        exp("c", 1000, "2026-07-01", { deletedAt: "2026-07-20T10:00:00.000Z" }),
        exp("c", 2000, "2026-07-15", { deletedAt: "2026-07-16T10:00:00.000Z" }),
      ],
    });
    expect(deletedExpenses(ds).map((e) => e.amountCents)).toEqual([1000, 2000]);
  });

  it("caps the list", () => {
    const ds = dataset({
      expenses: Array.from({ length: 30 }, (_, i) =>
        exp("c", 100 + i, `2026-07-${String((i % 28) + 1).padStart(2, "0")}`, {
          deletedAt: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
        }),
      ),
    });
    expect(deletedExpenses(ds)).toHaveLength(20);
    expect(deletedExpenses(ds, 5)).toHaveLength(5);
  });

  it("is empty when nothing was deleted", () => {
    expect(deletedExpenses(dataset({ expenses: [exp("c", 1000, "2026-07-01")] }))).toEqual([]);
  });
});

describe("categoryExpenseCounts (dashboard filter)", () => {
  const categories = [
    cat("courses", "2026-06", { sortOrder: 1 }),
    cat("loisirs", "2026-06", { sortOrder: 2 }),
    cat("essence", "2026-06", { sortOrder: 3 }),
  ];

  it("counts lines per category, in sort order", () => {
    const counts = categoryExpenseCounts(
      [
        exp("loisirs", 1000, "2026-07-02"),
        exp("courses", 2000, "2026-07-03"),
        exp("courses", 3000, "2026-07-04"),
      ],
      categories,
    );
    expect(counts.map((c) => [c.category.id, c.count])).toEqual([
      ["courses", 2],
      ["loisirs", 1],
    ]);
  });

  it("drops categories with no expense rather than showing a zero", () => {
    const counts = categoryExpenseCounts([exp("courses", 2000, "2026-07-03")], categories);
    expect(counts.map((c) => c.category.id)).toEqual(["courses"]);
  });

  it("is empty when there is nothing to filter", () => {
    expect(categoryExpenseCounts([], categories)).toEqual([]);
  });

  it("keeps an archived category that still holds expenses", () => {
    const counts = categoryExpenseCounts(
      [exp("old", 2000, "2026-07-03")],
      [cat("old", "2026-01", { archivedAt: "2026-07-20T00:00:00.000Z" })],
    );
    expect(counts.map((c) => [c.category.id, c.count])).toEqual([["old", 1]]);
  });

  it("ignores expenses whose category no longer exists", () => {
    const counts = categoryExpenseCounts(
      [exp("courses", 2000, "2026-07-03"), exp("ghost", 5000, "2026-07-05")],
      categories,
    );
    expect(counts.map((c) => c.category.id)).toEqual(["courses"]);
  });

  it("counts the list it is given (a month's expenses)", () => {
    const ds = dataset({
      categories,
      expenses: [
        exp("courses", 1000, "2026-07-03"),
        exp("courses", 2000, "2026-08-01"),
        exp("loisirs", 3000, "2026-07-09", { deletedAt: "2026-07-10T00:00:00.000Z" }),
      ],
    });
    const counts = categoryExpenseCounts(expensesForMonth(ds, "2026-07"), categories);
    expect(counts.map((c) => [c.category.id, c.count])).toEqual([["courses", 1]]);
  });
});
