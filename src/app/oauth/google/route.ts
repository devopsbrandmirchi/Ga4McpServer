import {
  buildGoogleAuthUrl,
  createPkcePair,
  createSignedOAuthState,
} from "@/google/auth";
import { getConfig } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { escapeHtml, htmlResponse, pageHtml } from "@/lib/html";
import { logger } from "@/lib/logger";
import { oauthCookieHeaders, requestIsHttps } from "@/lib/oauth-cookies";
import { tokensEqual } from "@/mcp/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startForm(errorMessage?: string): string {
  return pageHtml(
    "Connect Google",
    `
      <h1>Connect your Google account</h1>
      <p>This personal connector will request read-only Google Analytics access.</p>
      ${errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ""}
      <form method="post" action="/oauth/google">
        <label for="setupToken">Setup token</label>
        <input id="setupToken" name="setupToken" type="password" autocomplete="off" required />
        <p class="note">Enter the same value as <code>MCP_AUTH_TOKEN</code>.</p>
        <button type="submit">Continue to Google</button>
      </form>
    `,
  );
}

export function GET() {
  return htmlResponse(startForm());
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const setupToken = String(form.get("setupToken") ?? "");
    const expected = getConfig().mcpAuthToken;
    if (!setupToken || !tokensEqual(setupToken, expected)) {
      return htmlResponse(startForm("The setup token is incorrect."), 401);
    }

    const { verifier, challenge } = createPkcePair();
    const state = createSignedOAuthState();
    const authUrl = buildGoogleAuthUrl({
      state,
      codeChallenge: challenge,
    });

    const headers = new Headers({ Location: authUrl });
    for (const cookie of oauthCookieHeaders({
      state,
      verifier,
      secure: requestIsHttps(req),
    })) {
      headers.append("Set-Cookie", cookie);
    }

    return new Response(null, { status: 302, headers });
  } catch (error) {
    logger.error("Failed to start Google OAuth");
    const message =
      error instanceof AppError
        ? error.message
        : "Could not start Google authorization. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_BASE_URL.";
    return htmlResponse(startForm(message), 500);
  }
}
