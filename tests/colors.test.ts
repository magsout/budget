import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, isHexColor } from "../src/lib/colors.ts";

describe("colors", () => {
  it("exposes a non-empty palette of valid hex colors", () => {
    expect(CATEGORY_COLORS.length).toBeGreaterThan(0);
    for (const c of CATEGORY_COLORS) expect(isHexColor(c)).toBe(true);
  });

  it("uses a palette color as the default", () => {
    expect(CATEGORY_COLORS).toContain(DEFAULT_CATEGORY_COLOR);
  });

  it("validates hex strings", () => {
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("#2563eb")).toBe(true);
    expect(isHexColor("#2563EB")).toBe(true);
    expect(isHexColor("2563eb")).toBe(false);
    expect(isHexColor("#12")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor(null)).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
  });
});
