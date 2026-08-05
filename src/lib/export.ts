/**
 * Getting the data back out. Everything lives in a single Firestore project;
 * these two functions are the copy you can keep elsewhere — a JSON snapshot to
 * re-import, and a CSV of the ledger to open in a spreadsheet.
 *
 * Pure string builders: no DOM, no download logic, so the tricky part (CSV
 * escaping) is unit-testable.
 */
import type { Dataset, Expense } from "./types.ts";

/**
 * `;` rather than `,`: French Excel splits on the semicolon by default, and
 * opening the file is the whole point of exporting it.
 */
const SEP = ";";

/**
 * Quote a CSV field when it could otherwise break the row: the separator, a
 * quote, or any newline. Embedded quotes are doubled (RFC 4180).
 */
function csvField(value: string): string {
  if (!/[";\r\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

/** Amount as a decimal with a comma, matching the locale of the separator. */
function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * The expense ledger as CSV, most recent first, with categories and users
 * resolved to names. Soft-deleted rows are included and flagged rather than
 * dropped — an export is a backup, not a view.
 */
export function expensesToCsv(dataset: Dataset): string {
  const categoryName = (id: string) => dataset.categories.find((c) => c.id === id)?.name ?? "";
  const userName = (id: string) => dataset.users.find((u) => u.id === id)?.firstName ?? "";

  const header = ["Date", "Poste", "Montant", "Qui", "Description", "Supprimée"];
  const rows = dataset.expenses
    .toSorted((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((e: Expense) =>
      [
        e.date,
        categoryName(e.categoryId),
        csvAmount(e.amountCents),
        userName(e.userId),
        e.description ?? "",
        e.deletedAt ? "oui" : "",
      ]
        .map(csvField)
        .join(SEP),
    );

  // Trailing newline: some tools drop the last row without it.
  return [header.join(SEP), ...rows].join("\r\n") + "\r\n";
}

/** The whole dataset, verbatim, as indented JSON. */
export function datasetToJson(dataset: Dataset): string {
  return JSON.stringify(dataset, null, 2);
}

/** File name stamped with the day, e.g. "budget-2026-08-06.csv". */
export function exportFileName(extension: string, today: string): string {
  return `budget-${today}.${extension}`;
}
