import { describe, expect, it } from "vitest";
import { moveInList } from "../src/lib/order.ts";

describe("moveInList", () => {
  const base = ["a", "b", "c", "d"];

  it("moves an item up", () => {
    expect(moveInList(base, 2, -1)).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item down", () => {
    expect(moveInList(base, 1, 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("refuses to move the first item up, or the last one down", () => {
    expect(moveInList(base, 0, -1)).toEqual(base);
    expect(moveInList(base, 3, 1)).toEqual(base);
  });

  it("ignores an out-of-range index", () => {
    expect(moveInList(base, -1, 1)).toEqual(base);
    expect(moveInList(base, 9, -1)).toEqual(base);
  });

  it("leaves the input untouched", () => {
    const input = [...base];
    moveInList(input, 2, -1);
    expect(input).toEqual(base);
  });

  it("handles multi-step moves", () => {
    expect(moveInList(base, 3, -3)).toEqual(["d", "a", "b", "c"]);
  });
});
