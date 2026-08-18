import { describe, expect, it } from "vitest";
import { realtimeReportInputSchema, runReportInputSchema } from "@/mcp/tools/schemas";

describe("report validation", () => {
  it("accepts a valid report request", () => {
    const parsed = runReportInputSchema.parse({
      propertyId: "123456789",
      dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
      dimensions: ["date", "country"],
      metrics: ["activeUsers", "sessions"],
      limit: 1000,
    });
    expect(parsed.limit).toBe(1000);
    expect(parsed.offset).toBe(0);
  });

  it("rejects an invalid property ID", () => {
    const result = runReportInputSchema.safeParse({
      propertyId: "website",
      dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
      metrics: ["activeUsers"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid dates, metrics, dimensions, and limits", () => {
    expect(
      runReportInputSchema.safeParse({
        propertyId: "123",
        dateRanges: [{ startDate: "last-week", endDate: "yesterday" }],
        metrics: ["activeUsers"],
      }).success,
    ).toBe(false);

    expect(
      runReportInputSchema.safeParse({
        propertyId: "123",
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        metrics: ["active users"],
      }).success,
    ).toBe(false);

    expect(
      runReportInputSchema.safeParse({
        propertyId: "123",
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        dimensions: ["bad-dimension"],
        metrics: ["activeUsers"],
      }).success,
    ).toBe(false);

    expect(
      runReportInputSchema.safeParse({
        propertyId: "123",
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        metrics: ["activeUsers"],
        limit: 50000,
      }).success,
    ).toBe(false);
  });

  it("validates realtime reports without date ranges", () => {
    const parsed = realtimeReportInputSchema.parse({
      propertyId: "properties/123456789",
      metrics: ["activeUsers"],
      dimensions: ["country"],
    });
    expect(parsed.propertyId).toBe("properties/123456789");
    expect(parsed.limit).toBe(1000);
  });
});
