import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { setRequiredEnv } from "@/test/env";

vi.mock("@/google/auth", () => ({
  getAuthorizedClient: vi.fn(async () => ({})),
}));

const reportRequest = {
  propertyId: "123456789",
  dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
  dimensions: ["date", "country"],
  metrics: ["activeUsers", "sessions"],
  limit: 1000,
};

describe("GA4 Data API helpers", () => {
  beforeEach(() => {
    setRequiredEnv({ GOOGLE_REFRESH_TOKEN: "1//refresh" });
  });

  it("normalizes report rows", async () => {
    const { runGa4Report } = await import("@/google/analytics");
    const result = await runGa4Report(reportRequest, () => ({
      runReport: vi.fn(async () => [
        {
          rowCount: 1,
          rows: [
            {
              dimensionValues: [{ value: "20260817" }, { value: "United States" }],
              metricValues: [{ value: "1234" }, { value: "1678" }],
            },
          ],
        },
      ]),
    }) as never);

    expect(result).toEqual({
      propertyId: "123456789",
      dateRanges: reportRequest.dateRanges,
      dimensions: ["date", "country"],
      metrics: ["activeUsers", "sessions"],
      rowCount: 1,
      rows: [
        {
          date: "20260817",
          country: "United States",
          activeUsers: 1234,
          sessions: 1678,
        },
      ],
    });
  });

  it("retrieves metadata", async () => {
    const { getPropertyMetadata } = await import("@/google/analytics");
    const result = await getPropertyMetadata("123456789", () => ({
      getMetadata: vi.fn(async () => [
        {
          dimensions: [
            {
              apiName: "country",
              uiName: "Country",
              description: "The country of the user",
              category: "Geography",
              customDefinition: false,
              deprecatedApiNames: [],
            },
          ],
          metrics: [
            {
              apiName: "activeUsers",
              uiName: "Active users",
              description: "The number of distinct users",
              category: "User",
              customDefinition: false,
              type: "TYPE_INTEGER",
              deprecatedApiNames: [],
            },
          ],
        },
      ]),
    }) as never);

    expect(result.propertyId).toBe("123456789");
    expect(result.dimensions[0]?.apiName).toBe("country");
    expect(result.metrics[0]?.apiName).toBe("activeUsers");
  });

  it("executes a realtime report", async () => {
    const { runGa4RealtimeReport } = await import("@/google/analytics");
    const result = await runGa4RealtimeReport(
      {
        propertyId: "123456789",
        dimensions: ["country"],
        metrics: ["activeUsers"],
        limit: 10,
      },
      () => ({
        runRealtimeReport: vi.fn(async () => [
          {
            rowCount: 1,
            rows: [
              {
                dimensionValues: [{ value: "India" }],
                metricValues: [{ value: "12" }],
              },
            ],
          },
        ]),
      }) as never,
    );

    expect(result.rows).toEqual([{ country: "India", activeUsers: 12 }]);
  });

  it("maps invalid property and field errors", async () => {
    const { runGa4Report } = await import("@/google/analytics");

    await expect(
      runGa4Report(reportRequest, () => ({
        runReport: vi.fn(async () => {
          throw { code: 403, message: "Caller does not have permission" };
        }),
      }) as never),
    ).rejects.toMatchObject({ code: "invalid_property" });

    await expect(
      runGa4Report(
        { ...reportRequest, metrics: ["notARealMetric"] },
        () => ({
          runReport: vi.fn(async () => {
            throw { code: 400, message: "Field metric 'notARealMetric' is invalid" };
          }),
        }) as never,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
