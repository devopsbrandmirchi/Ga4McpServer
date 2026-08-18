import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/health/route";
import { setRequiredEnv } from "@/test/env";

describe("/health", () => {
  beforeEach(() => {
    setRequiredEnv();
  });

  it("reports status without exposing secrets or OAuth details", async () => {
    const response = GET();
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
    expect(JSON.stringify(body)).not.toContain("test-mcp-token");
    expect(JSON.stringify(body)).not.toContain("test-client-secret");
    expect(body).not.toHaveProperty("googleConnected");
  });
});
