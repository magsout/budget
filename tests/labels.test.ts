import { describe, expect, it } from "vitest";
import { carryLabel, remainingTone } from "../src/lib/labels.ts";

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

describe("remainingTone", () => {
  it("is negative as soon as the poste is overdrawn", () => {
    expect(remainingTone(-1, 65600)).toBe("negative");
    // The real "Autres" poste: 900 € budget, 1 646 € spent.
    expect(remainingTone(-74600, 90000)).toBe("negative");
  });

  it("warns under 15% of what was available", () => {
    expect(remainingTone(9839, 65600)).toBe("warning"); // 14,99%
    expect(remainingTone(9840, 65600)).toBe("positive"); // exactly 15%
  });

  it("is positive with room left", () => {
    expect(remainingTone(65600, 65600)).toBe("positive");
    expect(remainingTone(20000, 65600)).toBe("positive"); // 30%
  });

  it("warns on the real Courses poste", () => {
    // 24,17 € left of a 656,00 € budget is 3,7% — amber, which is what the app
    // already showed. Recorded here because the Historique tab used to render the
    // very same state green.
    expect(remainingTone(2417, 65600)).toBe("warning");
  });

  it("does not warn when nothing was available to spend", () => {
    // 0 of 0 is not "nearly out" — there was never a budget to run down.
    expect(remainingTone(0, 0)).toBe("positive");
    expect(remainingTone(-500, 0)).toBe("negative");
  });
});
