import type { AuthInfo } from "@modelcontextprotocol/server";
import { getConfig } from "@/lib/config";
import { tokensEqual } from "@/lib/secure-compare";
import { readAccessToken } from "@/mcp/oauth/tokens";

export { tokensEqual };

export function extractMcpToken(req: Request): string | undefined {
  const authorization = req.headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const apiKey = req.headers.get("x-api-key")?.trim();
  if (apiKey) {
    return apiKey.replace(/^Bearer\s+/i, "");
  }

  const authToken = req.headers.get("x-auth-token")?.trim();
  if (authToken) {
    return authToken.replace(/^Bearer\s+/i, "");
  }

  return undefined;
}

export function isStaticMcpToken(token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  return tokensEqual(token, getConfig().mcpAuthToken);
}

export function isAuthorizedRequest(req: Request): boolean {
  return isStaticMcpToken(extractMcpToken(req));
}

export async function isAuthorizedToken(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }
  if (isStaticMcpToken(token)) {
    return true;
  }
  try {
    readAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

export async function verifyMcpToken(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const token = bearerToken?.trim() || extractMcpToken(req);
  if (!token) {
    return undefined;
  }

  if (isStaticMcpToken(token)) {
    return {
      token,
      scopes: ["ga4:read"],
      clientId: "personal-operator",
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    };
  }

  try {
    const payload = readAccessToken(token);
    return {
      token,
      scopes: payload.scope.split(/\s+/).filter(Boolean),
      clientId: payload.client_id,
      expiresAt: payload.exp,
    };
  } catch {
    return undefined;
  }
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
