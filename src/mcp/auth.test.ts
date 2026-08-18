import { beforeEach, describe, expect, it } from "vitest";
import { extractMcpToken, isAuthorizedRequest, verifyMcpToken } from "@/mcp/auth";
import { setRequiredEnv } from "@/test/env";

describe("MCP authentication", () => {
  beforeEach(() => {
    setRequiredEnv();
  });

  it("accepts a Bearer token", async () => {
    const req = new Request("http://localhost:3000/ga4mcp", {
      headers: { Authorization: "Bearer test-mcp-token" },
    });
    expect(isAuthorizedRequest(req)).toBe(true);
    await expect(verifyMcpToken(req, "test-mcp-token")).resolves.toMatchObject({
      clientId: "personal-operator",
      scopes: ["ga4:read"],
    });
  });

  it("accepts x-api-key and x-auth-token", () => {
    const apiKeyReq = new Request("http://localhost:3000/ga4mcp", {
      headers: { "x-api-key": "test-mcp-token" },
    });
    const authTokenReq = new Request("http://localhost:3000/ga4mcp", {
      headers: { "x-auth-token": "test-mcp-token" },
    });
    expect(extractMcpToken(apiKeyReq)).toBe("test-mcp-token");
    expect(isAuthorizedRequest(authTokenReq)).toBe(true);
  });

  it("rejects a missing or incorrect token", async () => {
    const missing = new Request("http://localhost:3000/ga4mcp");
    const wrong = new Request("http://localhost:3000/ga4mcp", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(isAuthorizedRequest(missing)).toBe(false);
    expect(isAuthorizedRequest(wrong)).toBe(false);
    await expect(verifyMcpToken(wrong, "wrong-token")).resolves.toBeUndefined();
  });
});
