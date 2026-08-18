import { describe, expect, it } from "vitest";
import { normalizePropertyId, toPropertyResourceName } from "@/lib/property-id";

describe("property IDs", () => {
  it("accepts numeric IDs and resource names", () => {
    expect(normalizePropertyId("123456789")).toBe("123456789");
    expect(normalizePropertyId("properties/123456789")).toBe("123456789");
    expect(toPropertyResourceName("123456789")).toBe("properties/123456789");
  });

  it("rejects invalid IDs", () => {
    expect(() => normalizePropertyId("my-site")).toThrow(/Invalid GA4 property ID/);
  });
});
