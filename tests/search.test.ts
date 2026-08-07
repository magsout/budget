import { describe, expect, it } from "vitest";
import { searchExpenses } from "../src/lib/search.ts";
import type { Expense } from "../src/lib/types.ts";

function exp(
  id: string,
  amountCents: number,
  date: string,
  description: string | null = null,
): Expense {
  return {
    id,
    categoryId: "c",
    userId: "u",
    amountCents,
    description,
    date,
    createdAt: `${date}T12:00:00.000Z`,
    deletedAt: null,
  };
}

const rows = [
  exp("a", 4250, "2026-08-07"), // 42,50 € le 7 août
  exp("b", 12300, "2026-08-18"), // 123,00 € le 18 août
  exp("c", 650, "2026-08-07"), // 6,50 € le 7 août
  exp("d", 4250, "2026-09-02"), // 42,50 € le 2 septembre
];

const ids = (list: Expense[]) => list.map((e) => e.id);

describe("searchExpenses — montant", () => {
  it("trouve par euros entiers", () => {
    expect(ids(searchExpenses(rows, "42"))).toEqual(["a", "d"]);
  });

  it("accepte la virgule et le point", () => {
    expect(ids(searchExpenses(rows, "42,50"))).toEqual(["a", "d"]);
    expect(ids(searchExpenses(rows, "42.50"))).toEqual(["a", "d"]);
  });

  it("trouve un montant court", () => {
    expect(ids(searchExpenses(rows, "6,50"))).toEqual(["c"]);
  });
});

describe("searchExpenses — date", () => {
  it("trouve par jour", () => {
    expect(ids(searchExpenses(rows, "18"))).toEqual(["b"]);
  });

  it("accepte les formats jour/mois, avec ou sans zéro", () => {
    expect(ids(searchExpenses(rows, "07/08"))).toEqual(["a", "c"]);
    expect(ids(searchExpenses(rows, "7/8"))).toEqual(["a", "c"]);
  });

  it("trouve par nom de mois, accent optionnel", () => {
    expect(ids(searchExpenses(rows, "septembre"))).toEqual(["d"]);
    expect(ids(searchExpenses(rows, "aout"))).toEqual(["a", "b", "c"]);
    expect(ids(searchExpenses(rows, "août"))).toEqual(["a", "b", "c"]);
  });

  it("trouve par date ISO", () => {
    expect(ids(searchExpenses(rows, "2026-09"))).toEqual(["d"]);
  });
});

describe("searchExpenses — description", () => {
  const withDesc = [
    exp("a", 4250, "2026-08-07", "Carrefour"),
    exp("b", 12300, "2026-08-18", "Café du marché"),
    exp("c", 650, "2026-08-07", null),
  ];

  it("trouve par description, sans casse", () => {
    expect(ids(searchExpenses(withDesc, "carrefour"))).toEqual(["a"]);
    expect(ids(searchExpenses(withDesc, "CARREFOUR"))).toEqual(["a"]);
  });

  it("trouve par fragment, accent ignoré", () => {
    expect(ids(searchExpenses(withDesc, "marche"))).toEqual(["b"]);
    expect(ids(searchExpenses(withDesc, "café"))).toEqual(["b"]);
  });

  it("ignore sereinement une description absente", () => {
    expect(ids(searchExpenses(withDesc, "6,50"))).toEqual(["c"]);
  });

  it("croise description et montant", () => {
    expect(ids(searchExpenses(withDesc, "carrefour 42"))).toEqual(["a"]);
    expect(ids(searchExpenses(withDesc, "carrefour 123"))).toEqual([]);
  });
});

describe("searchExpenses — combinaisons", () => {
  it("ET entre les termes : montant ET date", () => {
    // 42,50 € il y en a deux ; un seul est en septembre.
    expect(ids(searchExpenses(rows, "42 septembre"))).toEqual(["d"]);
    expect(ids(searchExpenses(rows, "42 aout"))).toEqual(["a"]);
  });

  it("rend la liste intacte pour une requête vide ou blanche", () => {
    expect(searchExpenses(rows, "")).toEqual(rows);
    expect(searchExpenses(rows, "   ")).toEqual(rows);
  });

  it("ne renvoie rien quand aucun terme ne colle", () => {
    expect(searchExpenses(rows, "999")).toEqual([]);
    expect(ids(searchExpenses(rows, "42 decembre"))).toEqual([]);
  });
});
