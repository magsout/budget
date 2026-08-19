import { describe, expect, it } from "vitest";
import {
  accountSummary,
  isOneOffWindow,
  oneOffIncomesIn,
  activeInMonth,
  categoryBudgetsActiveIn,
  incomesActiveIn,
  recurringExpensesActiveIn,
} from "../src/lib/account.ts";
import type {
  BudgetVersion,
  Category,
  Dataset,
  Income,
  RecurringExpense,
} from "../src/lib/types.ts";

function rx(
  name: string,
  amountCents: number,
  over: Partial<RecurringExpense> = {},
): RecurringExpense {
  return {
    id: `rx-${name}`,
    name,
    amountCents,
    description: null,
    startMonth: null,
    endMonth: null,
    createdAt: "2026-01-01T09:00:00.000Z",
    deletedAt: null,
    ...over,
  };
}

function inc(name: string, amountCents: number, over: Partial<Income> = {}): Income {
  return {
    id: `inc-${name}`,
    name,
    amountCents,
    description: null,
    startMonth: null,
    endMonth: null,
    createdAt: "2026-01-01T09:00:00.000Z",
    deletedAt: null,
    ...over,
  };
}

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

describe("activeInMonth", () => {
  it("open-ended (null/null) is always active", () => {
    expect(activeInMonth({ startMonth: null, endMonth: null }, "2026-07")).toBe(true);
  });

  it("startMonth is inclusive", () => {
    const item = { startMonth: "2026-07", endMonth: null };
    expect(activeInMonth(item, "2026-06")).toBe(false);
    expect(activeInMonth(item, "2026-07")).toBe(true);
    expect(activeInMonth(item, "2026-08")).toBe(true);
  });

  it("endMonth is inclusive", () => {
    const item = { startMonth: null, endMonth: "2026-07" };
    expect(activeInMonth(item, "2026-06")).toBe(true);
    expect(activeInMonth(item, "2026-07")).toBe(true);
    expect(activeInMonth(item, "2026-08")).toBe(false);
  });

  it("respects a closed [start, end] window", () => {
    const item = { startMonth: "2026-03", endMonth: "2026-05" };
    expect(activeInMonth(item, "2026-02")).toBe(false);
    expect(activeInMonth(item, "2026-03")).toBe(true);
    expect(activeInMonth(item, "2026-05")).toBe(true);
    expect(activeInMonth(item, "2026-06")).toBe(false);
  });
});

describe("recurringExpensesActiveIn / incomesActiveIn", () => {
  it("excludes deleted and out-of-window items, sorts by amount desc then name", () => {
    const ds = dataset({
      recurringExpenses: [
        rx("Loyer", 120000),
        rx("Netflix", 1500, { deletedAt: "2026-07-02T00:00:00.000Z" }),
        rx("Assurance", 5000, { startMonth: "2026-08" }), // future
        rx("Crédit", 30000, { endMonth: "2026-06" }), // past
        rx("Internet", 3000),
      ],
    });
    const active = recurringExpensesActiveIn(ds, "2026-07");
    expect(active.map((e) => e.name)).toEqual(["Loyer", "Internet"]);
  });

  it("incomes follow the same rules", () => {
    const ds = dataset({
      incomes: [inc("Salaire", 250000), inc("Freelance", 40000, { startMonth: "2026-09" })],
    });
    expect(incomesActiveIn(ds, "2026-07").map((i) => i.name)).toEqual(["Salaire"]);
  });
});

describe("accountSummary", () => {
  it("computes income, expense and remaining (income − expense)", () => {
    const ds = dataset({
      incomes: [inc("Salaire", 250000), inc("Prime", 50000)],
      recurringExpenses: [rx("Loyer", 120000), rx("Internet", 3000)],
    });
    expect(accountSummary(ds, "2026-07")).toEqual({
      incomeCents: 300000,
      expenseCents: 123000,
      remainingCents: 177000,
      budgetCents: 0,
      apportCents: 0,
      remainingAfterBudgetsCents: 177000,
    });
  });

  it("goes negative when expenses exceed incomes", () => {
    const ds = dataset({
      incomes: [inc("Salaire", 100000)],
      recurringExpenses: [rx("Loyer", 120000)],
    });
    expect(accountSummary(ds, "2026-07").remainingCents).toBe(-20000);
  });

  it("empty dataset yields zeros", () => {
    expect(accountSummary(dataset(), "2026-07")).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      remainingCents: 0,
      budgetCents: 0,
      apportCents: 0,
      remainingAfterBudgetsCents: 0,
    });
  });

  it("ignores items outside the displayed month (forecasting)", () => {
    const ds = dataset({
      incomes: [inc("Salaire", 100000)],
      recurringExpenses: [rx("Futur", 20000, { startMonth: "2026-09" })],
    });
    expect(accountSummary(ds, "2026-07").expenseCents).toBe(0);
    expect(accountSummary(ds, "2026-09").expenseCents).toBe(20000);
  });

  it("deducts active category budgets from the disposable remainder", () => {
    const ds = dataset({
      incomes: [inc("Salaire", 300000)],
      recurringExpenses: [rx("Loyer", 120000)],
      categories: [cat("courses", "2026-01"), cat("loisirs", "2026-01")],
      budgetVersions: [ver("courses", 65000, "2026-01"), ver("loisirs", 20000, "2026-01")],
    });
    const s = accountSummary(ds, "2026-07");
    expect(s.budgetCents).toBe(85000);
    expect(s.remainingCents).toBe(180000); // income − expense, unchanged
    expect(s.remainingAfterBudgetsCents).toBe(95000); // − budgets
  });

  it("excludes archived and not-yet-created postes from the budget total (per month)", () => {
    const ds = dataset({
      categories: [
        cat("courses", "2026-01"),
        cat("vacances", "2026-09"), // created after the displayed month
        cat("ancien", "2026-01", { archivedAt: "2026-05-01T00:00:00.000Z" }), // archived before
      ],
      budgetVersions: [
        ver("courses", 65000, "2026-01"),
        ver("vacances", 30000, "2026-09"),
        ver("ancien", 10000, "2026-01"),
      ],
    });
    expect(accountSummary(ds, "2026-07").budgetCents).toBe(65000);
  });
});

describe("categoryBudgetsActiveIn", () => {
  it("sorts by amount desc then name, and drops zero-budget postes", () => {
    const ds = dataset({
      categories: [cat("courses", "2026-01"), cat("loisirs", "2026-01"), cat("neuf", "2026-08")],
      budgetVersions: [ver("courses", 65000, "2026-01"), ver("loisirs", 20000, "2026-01")],
      // "neuf" is active in 2026-08+ but has no version yet in 2026-07 → 0 → dropped
    });
    const lines = categoryBudgetsActiveIn(ds, "2026-07");
    expect(lines.map((l) => [l.category.id, l.amountCents])).toEqual([
      ["courses", 65000],
      ["loisirs", 20000],
    ]);
  });

  it("uses the versioned amount in effect for the month", () => {
    const ds = dataset({
      categories: [cat("courses", "2026-01")],
      budgetVersions: [ver("courses", 65000, "2026-01"), ver("courses", 70000, "2026-07")],
    });
    expect(categoryBudgetsActiveIn(ds, "2026-06")[0].amountCents).toBe(65000);
    expect(categoryBudgetsActiveIn(ds, "2026-07")[0].amountCents).toBe(70000);
  });
});

describe("one-off windows", () => {
  it("is one-off when the window is a single month", () => {
    expect(
      isOneOffWindow(inc("prime", 80000, { startMonth: "2026-09", endMonth: "2026-09" })),
    ).toBe(true);
  });

  it("is not one-off when open-ended or spanning months", () => {
    expect(isOneOffWindow(inc("salaire", 250000, { startMonth: null, endMonth: null }))).toBe(
      false,
    );
    expect(isOneOffWindow(inc("salaire", 250000, { startMonth: "2026-01", endMonth: null }))).toBe(
      false,
    );
    expect(isOneOffWindow(inc("salaire", 250000, { startMonth: null, endMonth: "2026-09" }))).toBe(
      false,
    );
    expect(
      isOneOffWindow(inc("prime", 80000, { startMonth: "2026-08", endMonth: "2026-09" })),
    ).toBe(false);
  });

  it("lists only the one-offs landing in the month", () => {
    const ds = dataset({
      incomes: [
        inc("salaire", 250000, { startMonth: null, endMonth: null }),
        inc("prime", 80000, { startMonth: "2026-09", endMonth: "2026-09" }),
        inc("vieille", 50000, { startMonth: "2026-07", endMonth: "2026-07" }),
      ],
    });
    expect(oneOffIncomesIn(ds, "2026-09").map((i) => i.id)).toEqual(["inc-prime"]);
  });
});

const apport = (amountCents: number, month: string) => ({
  id: `ap-${month}-${amountCents}`,
  month,
  fromCategoryId: null,
  toCategoryId: "courses",
  fromIncomeId: "prime",
  amountCents,
  label: null,
  createdAt: `${month}-01T09:00:00.000Z`,
  deletedAt: null,
});

describe("accountSummary deducts apports", () => {
  const ds = (movements: Dataset["budgetMovements"]) =>
    dataset({
      incomes: [inc("salaire", 300000, { startMonth: null, endMonth: null })],
      budgetMovements: movements,
    });

  it("counts apports of the month and takes them off the disposable", () => {
    const summary = accountSummary(ds([apport(80000, "2026-09")]), "2026-09");
    expect(summary.apportCents).toBe(80000);
    // The bonus went into the postes, so it is no longer money to spend here.
    expect(summary.remainingAfterBudgetsCents).toBe(220000);
  });

  it("ignores apports of other months", () => {
    expect(accountSummary(ds([apport(80000, "2026-08")]), "2026-09").apportCents).toBe(0);
  });

  it("ignores transfers between postes — no money entered or left the household", () => {
    const transfers = [
      { ...apport(80000, "2026-09"), fromCategoryId: "autres", fromIncomeId: null },
    ];
    const summary = accountSummary(ds(transfers), "2026-09");
    expect(summary.apportCents).toBe(0);
    expect(summary.remainingAfterBudgetsCents).toBe(300000);
  });
});
