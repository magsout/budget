import { describe, expect, it } from "vitest";
import {
  accountSummary,
  activeInMonth,
  incomesActiveIn,
  recurringExpensesActiveIn,
} from "../src/lib/account.ts";
import type { Dataset, Income, RecurringExpense } from "../src/lib/types.ts";

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

function dataset(over: Partial<Dataset> = {}): Dataset {
  return {
    users: [],
    categories: [],
    budgetVersions: [],
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
});
