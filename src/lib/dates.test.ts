import { describe, expect, it } from "vitest";
import { assertGa4Date, isGa4Date } from "@/lib/dates";

describe("GA4 dates", () => {
  it("accepts relative and ISO dates without rewriting them", () => {
    for (const value of ["today", "yesterday", "7daysAgo", "30daysAgo", "90daysAgo", "2026-08-01"]) {
      expect(isGa4Date(value)).toBe(true);
      expect(assertGa4Date(value, "startDate")).toBe(value);
    }
  });

  it("rejects unsupported date formats", () => {
    expect(isGa4Date("last week")).toBe(false);
    expect(() => assertGa4Date("08/18/2026", "endDate")).toThrow(/Invalid endDate/);
  });
});
