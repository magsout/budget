import { describe, expect, it } from "vitest";
import {
  centsToInput,
  eurosToCents,
  formatCentsPlain,
  isValidPositiveAmount,
} from "../src/lib/money.ts";

describe("money", () => {
  it("parses comma and dot decimals to cents", () => {
    expect(eurosToCents("12,50")).toBe(1250);
    expect(eurosToCents("12.5")).toBe(1250);
    expect(eurosToCents("650")).toBe(65000);
    expect(eurosToCents(" 12 ")).toBe(1200);
  });

  it("rounds to the nearest cent without float drift", () => {
    expect(eurosToCents("0.1")).toBe(10);
    expect(eurosToCents("35.015")).toBe(3502);
    expect(eurosToCents(19.99)).toBe(1999);
  });

  it("returns NaN for non-numeric input", () => {
    expect(Number.isNaN(eurosToCents("abc"))).toBe(true);
    expect(Number.isNaN(eurosToCents(""))).toBe(true);
  });

  it("centsToInput renders a fixed 2-decimal comma string", () => {
    expect(centsToInput(65000)).toBe("650,00");
    expect(centsToInput(-3502)).toBe("-35,02");
  });

  it("isValidPositiveAmount rejects zero and negatives", () => {
    expect(isValidPositiveAmount("10")).toBe(true);
    expect(isValidPositiveAmount("0")).toBe(false);
    expect(isValidPositiveAmount("-5")).toBe(false);
    expect(isValidPositiveAmount("abc")).toBe(false);
  });
});

describe("formatCentsPlain", () => {
  it("groups thousands and drops the currency symbol", () => {
    // `centsToInput` renders this "4545,50" — fine in an input, hard to read in a
    // "spent / available" pair. fr-FR groups with a NARROW no-break space
    // (U+202F), which is not the U+00A0 that precedes the € sign.
    expect(formatCentsPlain(454550)).toBe("4 545,50");
    expect(formatCentsPlain(16160)).toBe("161,60");
    expect(formatCentsPlain(0)).toBe("0,00");
  });

  it("always shows two decimals", () => {
    expect(formatCentsPlain(65000)).toBe("650,00");
    expect(formatCentsPlain(5)).toBe("0,05");
  });

  it("keeps the sign of a negative amount", () => {
    expect(formatCentsPlain(-3502)).toBe("-35,02");
  });
});
