import { describe, expect, it } from "vitest";
import { readListFolded, writeListFolded } from "../src/lib/prefs.ts";

/** A stand-in for `localStorage`, so these run without a DOM. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    read: () => Object.fromEntries(map),
  };
}

/** Private browsing modes throw on any access rather than returning null. */
const throwingStorage = {
  getItem() {
    throw new DOMException("denied");
  },
  setItem() {
    throw new DOMException("denied");
  },
};

describe("readListFolded", () => {
  it("defaults to open when nothing was stored", () => {
    expect(readListFolded(fakeStorage(), "budget")).toBe(false);
  });

  it("reads a stored fold state", () => {
    expect(readListFolded(fakeStorage({ "budget:listFolded:budget": "1" }), "budget")).toBe(true);
    expect(readListFolded(fakeStorage({ "budget:listFolded:budget": "0" }), "budget")).toBe(false);
  });

  it("keeps each list independent", () => {
    const storage = fakeStorage({ "budget:listFolded:budget": "1" });
    expect(readListFolded(storage, "budget")).toBe(true);
    expect(readListFolded(storage, "history")).toBe(false);
  });

  it("falls back to open when storage throws", () => {
    expect(readListFolded(throwingStorage, "budget")).toBe(false);
  });

  it("treats an unexpected value as open rather than truthy", () => {
    expect(readListFolded(fakeStorage({ "budget:listFolded:budget": "true" }), "budget")).toBe(
      false,
    );
  });
});

describe("writeListFolded", () => {
  it("round-trips through storage", () => {
    const storage = fakeStorage();
    writeListFolded(storage, "budget", true);
    expect(readListFolded(storage, "budget")).toBe(true);
    writeListFolded(storage, "budget", false);
    expect(readListFolded(storage, "budget")).toBe(false);
  });

  it("stores under a namespaced, per-list key", () => {
    const storage = fakeStorage();
    writeListFolded(storage, "history", true);
    expect(storage.read()).toEqual({ "budget:listFolded:history": "1" });
  });

  it("does not throw when storage refuses to write", () => {
    expect(() => writeListFolded(throwingStorage, "budget", true)).not.toThrow();
  });
});
