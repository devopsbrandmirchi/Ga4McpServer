import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRequiredEnv } from "@/test/env";

vi.mock("@/google/auth", () => ({
  getAuthorizedClient: vi.fn(async () => ({})),
}));

describe("property listing", () => {
  beforeEach(() => {
    setRequiredEnv({ GOOGLE_REFRESH_TOKEN: "1//refresh" });
  });

  it("returns normalized property summaries", async () => {
    const { listGa4Properties } = await import("@/google/admin");
    const properties = await listGa4Properties(() => ({
      listAccountSummariesAsync: async function* () {
        yield {
          displayName: "My Google Analytics Account",
          propertySummaries: [
            {
              displayName: "My Website",
              property: "properties/123456789",
              propertyType: "PROPERTY_TYPE_ORDINARY",
            },
          ],
        };
      },
    }) as never);

    expect(properties).toEqual([
      {
        propertyName: "My Website",
        propertyId: "123456789",
        account: "My Google Analytics Account",
        propertyType: "PROPERTY_TYPE_ORDINARY",
      },
    ]);
  });
});
