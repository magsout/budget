import { describe, expect, it } from "vitest";
import {
  formatPct,
  largestRemainder,
  share,
  stackWidths,
  sumAmountCents,
} from "../src/lib/shape.ts";

describe("sumAmountCents", () => {
  it("is 0 on an empty list", () => {
    expect(sumAmountCents([])).toBe(0);
  });

  it("returns the single amount of a one-item list", () => {
    expect(sumAmountCents([{ amountCents: 65010 }])).toBe(65010);
  });

  it("keeps negative amounts in the sum", () => {
    // A corrected expense can carry a negative amount; it must lower the total,
    // not be skipped.
    expect(sumAmountCents([{ amountCents: 5000 }, { amountCents: -1250 }])).toBe(3750);
  });

  it("stays exact over a whole month of rows", () => {
    const rows = Array.from({ length: 61 }, (_, i) => ({ amountCents: i + 1 }));
    expect(sumAmountCents(rows)).toBe((61 * 62) / 2);
  });

  it("ignores the other fields of the items it sums", () => {
    const rows = [
      { id: "a", amountCents: 100, name: "Netflix" },
      { id: "b", amountCents: 250, name: "Internet" },
    ];
    expect(sumAmountCents(rows)).toBe(350);
  });
});

/** fr-FR separates the number from the % with a NO-BREAK space (U+00A0). */
const plain = (s: string) => s.replaceAll(" ", " ");

describe("share / formatPct", () => {
  it("keeps the French no-break space before the percent sign", () => {
    // Not cosmetic: a plain space would let "36" and "%" be split across lines.
    expect(formatPct(0.36)).toContain(" %");
  });

  it("is 0 when there is no total to divide by", () => {
    expect(share(500, 0)).toBe(0);
    expect(plain(formatPct(share(500, 0)))).toBe("0 %");
  });

  it("renders the real weights of the Compte screen", () => {
    // Prêt maison 804,86 € of 2 231,82 € of monthly charges.
    expect(plain(formatPct(share(80486, 223182)))).toBe("36 %");
    expect(plain(formatPct(share(28500, 223182)))).toBe("13 %");
  });

  it("never labels a real cost 0 %", () => {
    // Netflix at 7,99 € is 0,36% of the charges — "0 %" would be a lie by rounding.
    expect(plain(formatPct(share(799, 223182)))).toBe("< 1 %");
    expect(plain(formatPct(0))).toBe("0 %");
  });

  it("rounds to whole percents", () => {
    expect(plain(formatPct(0.5))).toBe("50 %");
    expect(plain(formatPct(1))).toBe("100 %");
    expect(plain(formatPct(0.006))).toBe("1 %");
  });
});

describe("stackWidths", () => {
  it("splits two segments across the total", () => {
    const { pct, over } = stackWidths([6000, 4000], 10000);
    expect(pct).toEqual([60, 40]);
    expect(over).toBe(false);
  });

  it("closes the bar exactly on thirds", () => {
    // Rounding each segment on its own would give 33+33+33 = 99 and leave a
    // sliver of empty track at the end of a bar that should be full.
    const { pct } = stackWidths([1000, 1000, 1000], 3000);
    expect(pct.reduce((s, p) => s + p, 0)).toBe(100);
  });

  it("leaves a visible remainder for the Compte screen's 0,21 €", () => {
    // The real cascade: 2 231,82 € of charges + 1 694,00 € of budgets against
    // 3 926,03 € of income, leaving 0,21 €. That leftover is 0,005% of the bar —
    // rounding the segments DOWN (56 + 43) is what reserves it a whole point of
    // track instead of a sub-pixel sliver nobody can see.
    const { pct, over } = stackWidths([223182, 169400], 392603);
    expect(pct).toEqual([56, 43]);
    expect(pct.reduce((s, p) => s + p, 0)).toBe(99);
    expect(over).toBe(false);
  });

  it("fills the bar completely when the segments do consume the total", () => {
    const { pct, over } = stackWidths([223182, 169421], 392603);
    expect(pct.reduce((s, p) => s + p, 0)).toBe(100);
    expect(over).toBe(false);
  });

  it("rescales and reports when the segments exceed the total", () => {
    // The real "Autres" poste: 1 646 € spent against a 900 € budget.
    const { pct, over } = stackWidths([164600], 90000);
    expect(over).toBe(true);
    expect(pct).toEqual([100]);
  });

  it("still adds to 100 when overflowing across several segments", () => {
    const { pct, over } = stackWidths([100000, 100000], 90000);
    expect(over).toBe(true);
    expect(pct.reduce((s, p) => s + p, 0)).toBe(100);
  });

  it("returns zeros rather than dividing by nothing", () => {
    expect(stackWidths([0, 0], 0)).toEqual({ pct: [0, 0], over: false });
    expect(stackWidths([], 0)).toEqual({ pct: [], over: false });
  });

  it("gives a zero segment zero width", () => {
    const { pct } = stackWidths([10000, 0], 10000);
    expect(pct[1]).toBe(0);
  });
});

describe("largestRemainder", () => {
  // The invariant both callers depend on: a bar that closes exactly, and a pot
  // handed out to the cent. Tested here rather than twice over at each call site.
  it("hands out exactly the target when the reals sum to it", () => {
    // How both callers use it: the reals are a split OF the target, so the parts
    // must add back up to it exactly whatever the rounding.
    for (const target of [1, 7, 100, 4321, 39_999]) {
      const exact = [0.5, 0.25, 0.25].map((w) => w * target);
      const parts = largestRemainder(exact, target);
      expect(parts.reduce((s, p) => s + p, 0)).toBe(target);
    }
  });

  it("gives the spare units to the largest fractional parts", () => {
    // Floors are [0, 0, 0] and the target is 2, so the two biggest fractions win.
    expect(largestRemainder([0.9, 0.8, 0.1], 2)).toEqual([1, 1, 0]);
  });

  it("never hands out more than the target", () => {
    expect(largestRemainder([0.4, 0.4], 0)).toEqual([0, 0]);
  });

  it("leaves already-whole reals untouched", () => {
    expect(largestRemainder([2, 3, 5], 10)).toEqual([2, 3, 5]);
  });
});
