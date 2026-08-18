import { exchangeAuthorizationCode, verifyOAuthState } from "@/google/auth";
import { persistRefreshToken } from "@/google/tokens";
import { AppError } from "@/lib/errors";
import { escapeHtml, htmlResponse, pageHtml } from "@/lib/html";
import { logger } from "@/lib/logger";
import {
  clearOAuthCookieHeaders,
  readOAuthCookies,
  requestIsHttps,
} from "@/lib/oauth-cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function withClearedCookies(response: Response, req: Request): Response {
  const headers = new Headers(response.headers);
  for (const cookie of clearOAuthCookieHeaders(requestIsHttps(req))) {
    headers.append("Set-Cookie", cookie);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function errorPage(message: string): string {
  return pageHtml(
    "Google authorization failed",
    `
      <h1>Google authorization failed</h1>
      <p class="error">${escapeHtml(message)}</p>
      <p><a href="/oauth/google">Try again</a></p>
    `,
  );
}

function successPage(params: {
  persistedLocally: boolean;
  refreshToken?: string;
}): string {
  const productionHint = params.refreshToken
    ? `
      <p>Add this value to the Vercel environment variable <code>GOOGLE_REFRESH_TOKEN</code>, then redeploy. Do not commit it or share it.</p>
      <textarea readonly>${escapeHtml(params.refreshToken)}</textarea>
    `
    : `<p>The refresh token was saved to <code>.env.local</code>. Restart the local server if it was already running.</p>`;

  return pageHtml(
    "Google account connected",
    `
      <h1>Google account connected</h1>
      <p>Read-only Google Analytics access is now authorized for this personal connector.</p>
      ${productionHint}
      <p class="note">${
        params.persistedLocally
          ? "Local persistence succeeded."
          : "Vercel cannot persist the token automatically. Store it as GOOGLE_REFRESH_TOKEN and redeploy."
      }</p>
      <p><a href="/">Back</a></p>
    `,
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    return withClearedCookies(
      htmlResponse(errorPage("Google authorization was cancelled or denied."), 400),
      req,
    );
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const cookies = readOAuthCookies(req);

  if (!code || !returnedState || !cookies.state || !cookies.verifier) {
    return withClearedCookies(
      htmlResponse(errorPage("OAuth callback is missing the authorization code or state."), 400),
      req,
    );
  }

  try {
    verifyOAuthState(returnedState);
    if (returnedState !== cookies.state) {
      throw new AppError("OAuth state did not match.", "unauthorized", 401);
    }

    const { refreshToken } = await exchangeAuthorizationCode({
      code,
      codeVerifier: cookies.verifier,
    });

    const persistResult = await persistRefreshToken(refreshToken);
    logger.info("Google OAuth completed");

    const showToken = persistResult === "display";
    return withClearedCookies(
      htmlResponse(
        successPage({
          persistedLocally: persistResult === "env_local",
          refreshToken: showToken ? refreshToken : undefined,
        }),
      ),
      req,
    );
  } catch (error) {
    logger.error("Google OAuth callback failed");
    const message =
      error instanceof AppError
        ? error.message
        : "Could not complete Google authorization.";
    return withClearedCookies(htmlResponse(errorPage(message), 400), req);
  }
}

