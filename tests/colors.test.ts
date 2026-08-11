import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  isHexColor,
  posteColor,
} from "../src/lib/colors.ts";

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

describe("posteColor", () => {
  it("keeps an explicit valid color", () => {
    expect(posteColor({ id: "courses", color: "#16a34a" })).toBe("#16a34a");
    expect(posteColor({ id: "courses", color: "#FFF" })).toBe("#FFF");
  });

  it("falls back to a palette color when there is none, or it is unusable", () => {
    for (const color of [null, undefined, "bleu", "2563eb", ""]) {
      expect(CATEGORY_COLORS).toContain(posteColor({ id: "autres", color }));
    }
  });

  it("is deterministic for the same id", () => {
    expect(posteColor({ id: "autres" })).toBe(posteColor({ id: "autres" }));
  });

  it("separates the postes that the old derivation collided on", () => {
    // `avatarColorFor`'s hash is `h * 31 + c`, and 31 ≡ 1 (mod 10), so its
    // palette index is just the sum of the char codes mod 10 — these two used to
    // come out identical. Guarding the regression, not promising distinctness in
    // general: ten colors cannot separate arbitrarily many ids.
    expect(posteColor({ id: "courses" })).not.toBe(posteColor({ id: "autres" }));
    expect(posteColor({ id: "essences" })).not.toBe(posteColor({ id: "loisirs" }));
  });

  it("never returns something CSS cannot paint", () => {
    for (const id of ["", "a", "courses", "aB3-_é", "x".repeat(200)]) {
      expect(isHexColor(posteColor({ id }))).toBe(true);
    }
  });
});
