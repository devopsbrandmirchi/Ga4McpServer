import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";

describe("logger redaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not write tokens or client secrets", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("oauth", {
      refresh_token: "1//secret-refresh",
      access_token: "ya29.secret-access",
      client_secret: "super-secret",
      authorization: "Bearer mcp-token",
      note: "ok",
    });

    const printed = String(error.mock.calls[0]?.[0]);
    expect(printed).toContain("[REDACTED]");
    expect(printed).toContain("ok");
    expect(printed).not.toContain("1//secret-refresh");
    expect(printed).not.toContain("ya29.secret-access");
    expect(printed).not.toContain("super-secret");
    expect(printed).not.toContain("mcp-token");
  });
});
