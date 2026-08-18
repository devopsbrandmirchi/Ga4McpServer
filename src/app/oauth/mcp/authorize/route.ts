import { getConfig } from "@/lib/config";
import { escapeHtml, htmlResponse, pageHtml } from "@/lib/html";
import { logger } from "@/lib/logger";
import { tokensEqual } from "@/mcp/auth";
import { isRedirectAllowed, resolveClient } from "@/mcp/oauth/clients";
import { MCP_SCOPE } from "@/mcp/oauth/metadata";
import { issueAuthorizationCode } from "@/mcp/oauth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuthorizeQuery {
  responseType: string | null;
  clientId: string | null;
  redirectUri: string | null;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  scope: string | null;
}

function readQuery(url: URL): AuthorizeQuery {
  return {
    responseType: url.searchParams.get("response_type"),
    clientId: url.searchParams.get("client_id"),
    redirectUri: url.searchParams.get("redirect_uri"),
    state: url.searchParams.get("state"),
    codeChallenge: url.searchParams.get("code_challenge"),
    codeChallengeMethod: url.searchParams.get("code_challenge_method"),
    scope: url.searchParams.get("scope"),
  };
}

function authorizeForm(params: {
  query: AuthorizeQuery;
  displayHost: string;
  error?: string;
}): string {
  const hidden = Object.entries({
    response_type: params.query.responseType ?? "",
    client_id: params.query.clientId ?? "",
    redirect_uri: params.query.redirectUri ?? "",
    state: params.query.state ?? "",
    code_challenge: params.query.codeChallenge ?? "",
    code_challenge_method: params.query.codeChallengeMethod ?? "",
    scope: params.query.scope ?? MCP_SCOPE,
  })
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
    )
    .join("");

  return pageHtml(
    "Allow Claude to use this MCP server",
    `
      <h1>Allow Claude to call this GA4 MCP server</h1>
      <p>This is the Claude → MCP authorization step. It is not Google sign-in.</p>
      <p>Requesting client: <code>${escapeHtml(params.displayHost)}</code></p>
      <p>Scope: <code>${escapeHtml(params.query.scope || MCP_SCOPE)}</code></p>
      ${params.error ? `<p class="error">${escapeHtml(params.error)}</p>` : ""}
      <form method="post" action="/oauth/mcp/authorize">
        ${hidden}
        <label for="setupToken">Setup token</label>
        <input id="setupToken" name="setupToken" type="password" autocomplete="off" required />
        <p class="note">Enter the same value as <code>MCP_AUTH_TOKEN</code>.</p>
        <button type="submit">Allow access</button>
      </form>
    `,
  );
}

function oauthRedirect(redirectUri: string, params: Record<string, string>): Response {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
}

async function validateRequest(query: AuthorizeQuery) {
  if (query.responseType !== "code" || !query.clientId || !query.redirectUri) {
    throw new Error("The authorization request is missing response_type, client_id, or redirect_uri.");
  }
  if (!query.codeChallenge || query.codeChallengeMethod !== "S256") {
    throw new Error("This server requires PKCE with code_challenge_method=S256.");
  }

  const client = await resolveClient(query.clientId);
  if (!isRedirectAllowed(client, query.redirectUri)) {
    throw new Error("The redirect_uri is not registered for this client.");
  }
  return client;
}

export async function GET(req: Request) {
  const query = readQuery(new URL(req.url));
  try {
    const client = await validateRequest(query);
    return htmlResponse(authorizeForm({ query, displayHost: client.displayHost }));
  } catch (error) {
    return htmlResponse(
      pageHtml(
        "Authorization request rejected",
        `<h1>Authorization request rejected</h1><p class="error">${escapeHtml(
          error instanceof Error ? error.message : "Invalid request",
        )}</p>`,
      ),
      400,
    );
  }
}

export async function POST(req: Request) {
  const form = await req.formData();
  const query: AuthorizeQuery = {
    responseType: String(form.get("response_type") ?? ""),
    clientId: String(form.get("client_id") ?? ""),
    redirectUri: String(form.get("redirect_uri") ?? ""),
    state: String(form.get("state") ?? "") || null,
    codeChallenge: String(form.get("code_challenge") ?? ""),
    codeChallengeMethod: String(form.get("code_challenge_method") ?? ""),
    scope: String(form.get("scope") ?? "") || MCP_SCOPE,
  };
  const setupToken = String(form.get("setupToken") ?? "");

  try {
    const client = await validateRequest(query);
    if (!tokensEqual(setupToken, getConfig().mcpAuthToken)) {
      return htmlResponse(
        authorizeForm({
          query,
          displayHost: client.displayHost,
          error: "The setup token is incorrect.",
        }),
        401,
      );
    }

    const code = issueAuthorizationCode({
      clientId: query.clientId as string,
      redirectUri: query.redirectUri as string,
      codeChallenge: query.codeChallenge as string,
      scope: query.scope || MCP_SCOPE,
    });

    logger.info("Issued MCP authorization code");
    const params: Record<string, string> = { code };
    if (query.state) {
      params.state = query.state;
    }
    return oauthRedirect(query.redirectUri as string, params);
  } catch (error) {
    return htmlResponse(
      pageHtml(
        "Authorization failed",
        `<h1>Authorization failed</h1><p class="error">${escapeHtml(
          error instanceof Error ? error.message : "Invalid request",
        )}</p>`,
      ),
      400,
    );
  }
}
