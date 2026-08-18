import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { persistRefreshToken } from "@/google/tokens";
import { setRequiredEnv } from "@/test/env";

describe("token persistence", () => {
  let cwd: string;
  let previousCwd: string;

  beforeEach(async () => {
    setRequiredEnv();
    previousCwd = process.cwd();
    cwd = await mkdtemp(path.join(tmpdir(), "ga4-mcp-"));
    process.chdir(cwd);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it("writes the refresh token to .env.local outside Vercel", async () => {
    await expect(persistRefreshToken("1//refresh")).resolves.toBe("env_local");
    const contents = await readFile(path.join(cwd, ".env.local"), "utf8");
    expect(contents).toContain("GOOGLE_REFRESH_TOKEN=1//refresh");
    expect(process.env.GOOGLE_REFRESH_TOKEN).toBe("1//refresh");
  });

  it("does not write files on Vercel", async () => {
    setRequiredEnv({ VERCEL: "1" });
    await expect(persistRefreshToken("1//refresh")).resolves.toBe("display");
  });
});
