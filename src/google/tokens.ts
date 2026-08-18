import { promises as fs } from "node:fs";
import path from "node:path";
import { isVercelRuntime } from "@/lib/config";
import { logger } from "@/lib/logger";

export type TokenPersistResult = "env_local" | "display";

const REFRESH_TOKEN_LINE = /^GOOGLE_REFRESH_TOKEN=.*$/m;

export function readRefreshTokenFromEnv(): string | undefined {
  return process.env.GOOGLE_REFRESH_TOKEN?.trim() || undefined;
}

export function hasStoredRefreshToken(): boolean {
  return Boolean(readRefreshTokenFromEnv());
}

export async function persistRefreshToken(
  refreshToken: string,
): Promise<TokenPersistResult> {
  if (isVercelRuntime()) {
    return "display";
  }

  const envPath = path.join(process.cwd(), ".env.local");
  const line = `GOOGLE_REFRESH_TOKEN=${refreshToken}`;

  try {
    let contents = "";
    try {
      contents = await fs.readFile(envPath, "utf8");
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }

    const nextContents = contents.match(REFRESH_TOKEN_LINE)
      ? contents.replace(REFRESH_TOKEN_LINE, line)
      : `${contents}${contents && !contents.endsWith("\n") ? "\n" : ""}${line}\n`;

    await fs.writeFile(envPath, nextContents, "utf8");
    process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
    logger.info("Stored Google refresh token in .env.local");
    return "env_local";
  } catch (error) {
    logger.warn("Could not write Google refresh token to .env.local", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return "display";
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "ENOENT"
  );
}
