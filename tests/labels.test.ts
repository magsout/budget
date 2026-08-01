import { describe, expect, it } from "vitest";
import { carryLabel } from "../src/lib/labels.ts";

describe("carryLabel", () => {
  it("says nothing when there is no report", () => {
    expect(carryLabel({ carryInCents: 0, carryAdjusted: false })).toBeNull();
  });

  it("names a computed report without marking it", () => {
    const label = carryLabel({ carryInCents: 1250, carryAdjusted: false });
    expect(label).toContain("Report");
    expect(label).toContain("12,50");
    expect(label).not.toContain("ajusté");
  });

  it("marks a hand-set report", () => {
    expect(carryLabel({ carryInCents: 1250, carryAdjusted: true })).toContain("(ajusté)");
    expect(carryLabel({ carryInCents: -1250, carryAdjusted: true })).toContain("(ajusté)");
  });

  it("spells out a reset instead of showing a zero", () => {
    expect(carryLabel({ carryInCents: 0, carryAdjusted: true })).toBe("Report ignoré");
  });
});
