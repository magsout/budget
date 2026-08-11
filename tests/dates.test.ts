import { describe, expect, it } from "vitest";
import {
  currentMonth,
  formatDate,
  formatDayShort,
  formatMonth,
  isToday,
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

describe("date formatting", () => {
  it("formats a month, a date and a day header", () => {
    expect(formatMonth("2026-08")).toBe("Août 2026");
    expect(formatDate("2026-08-11")).toBe("11 août 2026");
    expect(formatDayShort("2026-08-11")).toBe("Mar. 11 août");
  });

  it("formatDayShort drops the year and keeps the weekday", () => {
    // The list is already scoped to one month, so the year would be noise.
    expect(formatDayShort("2026-08-01")).toBe("Sam. 1 août");
    expect(formatDayShort("2026-08-09")).toBe("Dim. 9 août");
  });

  /**
   * The formatter cache is keyed by option set. It used to be keyed on `month`
   * alone, so whichever of these ran FIRST won the `fr-FR|long` slot and the
   * others silently got its output. Calling them in both orders is what catches
   * that: run the whole trio twice, reversed, and demand identical results.
   */
  it("does not hand one format the cached formatter of another", () => {
    const forwards = [
      formatMonth("2026-08"),
      formatDate("2026-08-11"),
      formatDayShort("2026-08-11"),
    ];
    const backwards = [
      formatDayShort("2026-08-11"),
      formatDate("2026-08-11"),
      formatMonth("2026-08"),
    ].toReversed();
    expect(forwards).toEqual(backwards);
    // And they must all be different from each other — the collision made two
    // of them equal.
    expect(new Set(forwards).size).toBe(3);
  });

  it("isToday compares against the local day", () => {
    const now = new Date(2026, 7, 11, 23, 30, 0);
    expect(isToday("2026-08-11", now)).toBe(true);
    expect(isToday("2026-08-10", now)).toBe(false);
    expect(isToday("2026-07-11", now)).toBe(false);
  });
});
