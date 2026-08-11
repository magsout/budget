import { describe, expect, it } from "vitest";
import { defaultOpenDays, type ExpenseDay, groupExpensesByDay } from "../src/lib/grouping.ts";
import type { Expense } from "../src/lib/types.ts";

function exp(
  id: string,
  amountCents: number,
  date: string,
  createdAt = `${date}T12:00:00.000Z`,
): Expense {
  return {
    id,
    categoryId: "c",
    userId: "u",
    amountCents,
    description: null,
    date,
    createdAt,
    deletedAt: null,
  };
}

const ids = (day: ExpenseDay) => day.expenses.map((e) => e.id);

describe("groupExpensesByDay", () => {
  it("returns nothing for an empty list", () => {
    expect(groupExpensesByDay([])).toEqual([]);
  });

  it("wraps a single expense in a single day", () => {
    const days = groupExpensesByDay([exp("a", 5000, "2026-08-11")]);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-08-11");
    expect(days[0].totalCents).toBe(5000);
    expect(ids(days[0])).toEqual(["a"]);
  });

  it("keeps the order it was given inside a day", () => {
    // `expensesForMonth` breaks same-day ties by `createdAt` DESC. Re-sorting here
    // would silently drop that "most recently logged first" order.
    const rows = [
      exp("late", 1000, "2026-08-11", "2026-08-11T18:00:00.000Z"),
      exp("early", 2000, "2026-08-11", "2026-08-11T08:00:00.000Z"),
    ];
    const days = groupExpensesByDay(rows);
    expect(days).toHaveLength(1);
    expect(ids(days[0])).toEqual(["late", "early"]);
  });

  it("splits on each change of date, preserving the incoming day order", () => {
    const rows = [
      exp("a", 5000, "2026-08-11"),
      exp("b", 3290, "2026-08-11"),
      exp("c", 7815, "2026-08-10"),
      exp("d", 990, "2026-08-08"),
    ];
    const days = groupExpensesByDay(rows);
    expect(days.map((d) => d.date)).toEqual(["2026-08-11", "2026-08-10", "2026-08-08"]);
    expect(days.map((d) => d.totalCents)).toEqual([8290, 7815, 990]);
  });

  it("re-opens a day that appears twice rather than merging it", () => {
    // Defensive: the function's contract is "cut on change", not "bucket by key".
    // If an unsorted list ever reaches it, the totals must still add up.
    const rows = [
      exp("a", 100, "2026-08-11"),
      exp("b", 200, "2026-08-10"),
      exp("c", 300, "2026-08-11"),
    ];
    const days = groupExpensesByDay(rows);
    expect(days).toHaveLength(3);
    expect(days.reduce((s, d) => s + d.totalCents, 0)).toBe(600);
  });

  it("accounts for every row and every cent of a full month", () => {
    // 61 rows over 11 days, the real shape of the screen this exists for.
    const rows = Array.from({ length: 61 }, (_, i) =>
      exp(`e${i}`, (i + 1) * 100, `2026-08-${String(11 - (i % 11)).padStart(2, "0")}`),
    ).toSorted((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const days = groupExpensesByDay(rows);
    expect(days).toHaveLength(11);
    expect(days.reduce((s, d) => s + d.expenses.length, 0)).toBe(61);
    expect(days.reduce((s, d) => s + d.totalCents, 0)).toBe(
      rows.reduce((s, r) => s + r.amountCents, 0),
    );
  });
});

describe("defaultOpenDays", () => {
  const days = groupExpensesByDay([
    exp("a", 100, "2026-08-11"),
    exp("b", 100, "2026-08-11"),
    exp("c", 100, "2026-08-11"),
    exp("d", 100, "2026-08-10"),
    exp("e", 100, "2026-08-10"),
    exp("f", 100, "2026-08-09"),
  ]);

  it("opens every day when given no budget", () => {
    expect(defaultOpenDays(days)).toEqual(["2026-08-11", "2026-08-10", "2026-08-09"]);
  });

  it("returns nothing for an empty list", () => {
    expect(defaultOpenDays([], { maxRows: 15 })).toEqual([]);
    expect(defaultOpenDays([])).toEqual([]);
  });

  it("takes days from the top while the row budget lasts", () => {
    // 3 + 2 = 5 rows fits in 5; adding the third day would make 6.
    expect(defaultOpenDays(days, { maxRows: 5 })).toEqual(["2026-08-11", "2026-08-10"]);
    expect(defaultOpenDays(days, { maxRows: 6 })).toEqual([
      "2026-08-11",
      "2026-08-10",
      "2026-08-09",
    ]);
  });

  it("always keeps one day open, even at maxRows 0", () => {
    // A list where every group is collapsed reads as an empty screen.
    expect(defaultOpenDays(days, { maxRows: 0 })).toEqual(["2026-08-11"]);
  });

  it("keeps a single oversized day open rather than collapsing everything", () => {
    const one = groupExpensesByDay(
      Array.from({ length: 20 }, (_, i) => exp(`x${i}`, 100, "2026-08-11")),
    );
    expect(defaultOpenDays(one, { maxRows: 5 })).toEqual(["2026-08-11"]);
  });
});
