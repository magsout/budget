import { describe, expect, it } from "vitest";
import { datasetToJson, expensesToCsv, exportFileName } from "../src/lib/export.ts";
import type { Dataset, Expense } from "../src/lib/types.ts";

function dataset(over: Partial<Dataset> = {}): Dataset {
  return {
    users: [{ id: "u1", firstName: "Guillaume", createdAt: "2026-01-01T00:00:00.000Z" }],
    categories: [
      {
        id: "c1",
        name: "Courses",
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        archivedAt: null,
      },
    ],
    budgetVersions: [],
    carryOverrides: [],
    budgetMovements: [],
    expenses: [],
    recurringExpenses: [],
    incomes: [],
    ...over,
  };
}

function exp(over: Partial<Expense> = {}): Expense {
  return {
    id: "e1",
    categoryId: "c1",
    userId: "u1",
    amountCents: 1234,
    description: null,
    date: "2026-07-15",
    createdAt: "2026-07-15T12:00:00.000Z",
    deletedAt: null,
    ...over,
  };
}

describe("expensesToCsv", () => {
  it("writes a header and resolves ids to names", () => {
    const csv = expensesToCsv(dataset({ expenses: [exp()] }));
    const [header, row] = csv.trimEnd().split("\r\n");
    expect(header).toBe("Date;Poste;Montant;Qui;Description;Supprimée");
    expect(row).toBe("2026-07-15;Courses;12,34;Guillaume;;");
  });

  it("orders most recent first", () => {
    const csv = expensesToCsv(
      dataset({
        expenses: [
          exp({ id: "a", date: "2026-07-01", amountCents: 100 }),
          exp({ id: "b", date: "2026-07-20", amountCents: 200 }),
        ],
      }),
    );
    const dates = csv
      .trimEnd()
      .split("\r\n")
      .slice(1)
      .map((r) => r.split(";")[0]);
    expect(dates).toEqual(["2026-07-20", "2026-07-01"]);
  });

  it("quotes a description containing the separator", () => {
    const csv = expensesToCsv(dataset({ expenses: [exp({ description: "Pain; lait" })] }));
    expect(csv).toContain('"Pain; lait"');
  });

  it("doubles embedded quotes", () => {
    const csv = expensesToCsv(dataset({ expenses: [exp({ description: 'Chez "Paul"' })] }));
    expect(csv).toContain('"Chez ""Paul"""');
  });

  it("keeps a newline inside a quoted field instead of breaking the row", () => {
    const csv = expensesToCsv(dataset({ expenses: [exp({ description: "deux\nlignes" })] }));
    expect(csv).toContain('"deux\nlignes"');
    // Header + one record: the embedded newline must not create a third row.
    expect(csv.trimEnd().split("\r\n")).toHaveLength(2);
  });

  it("includes deleted rows and flags them — an export is a backup", () => {
    const csv = expensesToCsv(
      dataset({ expenses: [exp({ deletedAt: "2026-07-16T00:00:00.000Z" })] }),
    );
    expect(csv.trimEnd().split("\r\n")[1]).toMatch(/;oui$/);
  });

  it("leaves a name it cannot resolve empty rather than writing a placeholder", () => {
    const csv = expensesToCsv(dataset({ expenses: [exp({ categoryId: "ghost" })] }));
    expect(csv.trimEnd().split("\r\n")[1]).toBe("2026-07-15;;12,34;Guillaume;;");
  });

  it("still emits the header with no expenses", () => {
    expect(expensesToCsv(dataset())).toBe("Date;Poste;Montant;Qui;Description;Supprimée\r\n");
  });
});

describe("datasetToJson", () => {
  it("round-trips the dataset", () => {
    const ds = dataset({ expenses: [exp()] });
    expect(JSON.parse(datasetToJson(ds))).toEqual(ds);
  });
});

describe("exportFileName", () => {
  it("stamps the day", () => {
    expect(exportFileName("csv", "2026-08-06")).toBe("budget-2026-08-06.csv");
    expect(exportFileName("json", "2026-08-06")).toBe("budget-2026-08-06.json");
  });
});
