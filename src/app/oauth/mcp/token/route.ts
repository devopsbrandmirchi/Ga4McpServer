import { logger } from "@/lib/logger";
import {
  clientSecretMatches,
  extractBasicClientSecret,
  resolveClient,
  verifyPkce,
} from "@/mcp/oauth/clients";
import { corsJson, corsOptions } from "@/mcp/oauth/metadata";
import {
  accessTokenExpiresIn,
  issueAccessToken,
  issueRefreshToken,
  readAuthorizationCode,
  readRefreshToken,
} from "@/mcp/oauth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function oauthError(error: string, description: string, status = 400): Response {
  return corsJson({ error, error_description: description }, status);
}

function tokenResponse(clientId: string, scope: string): Response {
  return corsJson({
    access_token: issueAccessToken({ clientId, scope }),
    token_type: "Bearer",
    expires_in: accessTokenExpiresIn(),
    refresh_token: issueRefreshToken({ clientId, scope }),
    scope,
  });
}

export function OPTIONS() {
  return corsOptions();
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return oauthError(
      "invalid_request",
      "The token endpoint requires application/x-www-form-urlencoded.",
      415,
    );
  }

  const form = await req.formData();
  const grantType = String(form.get("grant_type") ?? "");
  const basic = extractBasicClientSecret(req);
  const clientId = String(form.get("client_id") ?? basic.clientId ?? "");
  const clientSecret = String(form.get("client_secret") ?? basic.clientSecret ?? "") || undefined;

  if (!clientId) {
    return oauthError("invalid_client", "client_id is required.", 401);
  }

  try {
    const client = await resolveClient(clientId);
    if (!clientSecretMatches(client, clientSecret)) {
      return oauthError("invalid_client", "Client authentication failed.", 401);
    }

    if (grantType === "authorization_code") {
      const code = String(form.get("code") ?? "");
      const redirectUri = String(form.get("redirect_uri") ?? "");
      const codeVerifier = String(form.get("code_verifier") ?? "");
      const payload = readAuthorizationCode(code);
      if (payload.client_id !== clientId || payload.redirect_uri !== redirectUri) {
        return oauthError("invalid_grant", "The authorization code does not match this client.");
      }
      if (!verifyPkce(codeVerifier, payload.code_challenge)) {
        return oauthError("invalid_grant", "PKCE verification failed.");
      }
      logger.info("Issued MCP access token");
      return tokenResponse(clientId, payload.scope);
    }

    if (grantType === "refresh_token") {
      const refreshToken = String(form.get("refresh_token") ?? "");
      const payload = readRefreshToken(refreshToken);
      if (payload.client_id !== clientId) {
        return oauthError("invalid_grant", "The refresh token does not match this client.");
      }
      logger.info("Refreshed MCP access token");
      return tokenResponse(clientId, payload.scope);
    }

    return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch {
    return oauthError("invalid_grant", "The authorization code or refresh token is not valid.");
  }
}
