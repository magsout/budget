import { describe, expect, it } from "vitest";
import {
  currentMonth,
  localToday,
  monthOf,
  monthRange,
  nextMonth,
  prevMonth,
} from "../src/lib/dates.ts";

describe("dates", () => {
  it("localToday uses local components, not UTC", () => {
    // 2026-07-22 23:30 local -> still the 22nd locally regardless of tz shift.
    const d = new Date(2026, 6, 22, 23, 30, 0);
    expect(localToday(d)).toBe("2026-07-22");
  });

  it("currentMonth pads single-digit months", () => {
    expect(currentMonth(new Date(2026, 0, 5))).toBe("2026-01");
    expect(currentMonth(new Date(2026, 11, 5))).toBe("2026-12");
  });

  it("monthOf extracts the month key from a date string", () => {
    expect(monthOf("2026-07-22")).toBe("2026-07");
  });

  it("nextMonth / prevMonth wrap across years", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(nextMonth("2026-07")).toBe("2026-08");
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(prevMonth("2026-08")).toBe("2026-07");
  });

  it("monthRange is inclusive and contiguous", () => {
    expect(monthRange("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("monthRange returns a single month when from == to", () => {
    expect(monthRange("2026-07", "2026-07")).toEqual(["2026-07"]);
  });

  it("monthRange returns [] when from is after to", () => {
    expect(monthRange("2026-08", "2026-07")).toEqual([]);
  });
});
