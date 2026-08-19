import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getAuthorize, POST as postAuthorize } from "@/app/oauth/mcp/authorize/route";
import { POST as postRegister } from "@/app/oauth/mcp/register/route";
import { POST as postToken } from "@/app/oauth/mcp/token/route";
import { GET as getAsMetadata } from "@/app/.well-known/oauth-authorization-server/route";
import { GET as getPrm } from "@/app/.well-known/oauth-protected-resource/ga4mcp/route";
import {
  CLAUDE_AI_CALLBACK,
  isRedirectAllowed,
  redirectUriMatches,
  resolveClient,
} from "@/mcp/oauth/clients";
import { authorizationServerMetadata, protectedResourceMetadata, wwwAuthenticateHeader } from "@/mcp/oauth/metadata";
import { issueAccessToken } from "@/mcp/oauth/tokens";
import { isAuthorizedToken, verifyMcpToken } from "@/mcp/auth";
import { callsProtectedTool, createGa4McpHandler, unauthorizedToolCallResponse } from "@/mcp/server";
import { setRequiredEnv } from "@/test/env";

function formRequest(url: string, fields: Record<string, string>, headers?: HeadersInit): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("MCP OAuth metadata", () => {
  beforeEach(() => {
    setRequiredEnv();
  });

  it("advertises the exact /ga4mcp resource and CIMD-capable authorization server", async () => {
    const prm = protectedResourceMetadata();
    expect(prm.resource).toBe("http://localhost:3000/ga4mcp");
    expect(prm.authorization_servers).toEqual(["http://localhost:3000"]);

    const as = authorizationServerMetadata();
    expect(as.client_id_metadata_document_supported).toBe(true);
    expect(as.token_endpoint_auth_methods_supported).toContain("none");
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(as.authorization_endpoint).toBe("http://localhost:3000/oauth/mcp/authorize");

    const prmResponse = await getPrm().json();
    const asResponse = await getAsMetadata().json();
    expect(prmResponse.resource).toBe(prm.resource);
    expect(asResponse.issuer).toBe(as.issuer);
  });
});

describe("CIMD redirect allowlist", () => {
  it("matches Claude.ai exactly and loopback redirects without the port", () => {
    expect(
      isRedirectAllowed(
        {
          clientId: "https://claude.ai/oauth/client",
          redirectUris: [CLAUDE_AI_CALLBACK],
          tokenEndpointAuthMethod: "none",
          displayHost: "claude.ai",
        },
        CLAUDE_AI_CALLBACK,
      ),
    ).toBe(true);
    expect(redirectUriMatches("http://127.0.0.1/callback", "http://127.0.0.1:3118/callback")).toBe(
      true,
    );
    expect(redirectUriMatches("http://localhost/callback", "http://localhost:4000/callback")).toBe(
      true,
    );
    expect(redirectUriMatches(CLAUDE_AI_CALLBACK, "https://evil.example/callback")).toBe(false);
  });
});

describe("authorize + token", () => {
  beforeEach(() => {
    setRequiredEnv();
  });

  it("issues a JWT access token after PKCE consent", async () => {
    const register = await postRegister(
      new Request("http://localhost:3000/oauth/mcp/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
          token_endpoint_auth_method: "none",
        }),
      }),
    );
    const registration = (await register.json()) as { client_id: string };
    expect(register.status).toBe(201);

    const verifier = "a".repeat(43);
    const challenge = await import("node:crypto").then(({ createHash }) =>
      createHash("sha256").update(verifier).digest("base64url"),
    );

    const authorize = await postAuthorize(
      formRequest("http://localhost:3000/oauth/mcp/authorize", {
        response_type: "code",
        client_id: registration.client_id,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_challenge: challenge,
        code_challenge_method: "S256",
        scope: "ga4:read",
        setupToken: "test-mcp-token",
      }),
    );
    expect(authorize.status).toBe(302);
    const location = new URL(authorize.headers.get("location") ?? "");
    const code = location.searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await postToken(
      formRequest("http://localhost:3000/oauth/mcp/token", {
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        client_id: registration.client_id,
        code_verifier: verifier,
      }),
    );
    const body = (await token.json()) as { access_token: string; token_type: string };
    expect(token.status).toBe(200);
    expect(body.token_type).toBe("Bearer");
    await expect(isAuthorizedToken(body.access_token)).resolves.toBe(true);

    const jsonToken = await postToken(
      new Request("http://localhost:3000/oauth/mcp/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: "https://claude.ai/api/mcp/auth_callback",
          client_id: registration.client_id,
          code_verifier: verifier,
        }),
      }),
    );
    expect(jsonToken.status).toBe(200);
  });

  it("shows the consent page for a valid authorize GET", async () => {
    const register = await postRegister(
      new Request("http://localhost:3000/oauth/mcp/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        }),
      }),
    );
    const { client_id } = (await register.json()) as { client_id: string };
    const url =
      "http://localhost:3000/oauth/mcp/authorize?response_type=code&client_id=" +
      encodeURIComponent(client_id) +
      "&redirect_uri=" +
      encodeURIComponent("https://claude.ai/api/mcp/auth_callback") +
      "&code_challenge=abc&code_challenge_method=S256";
    const response = await getAuthorize(new Request(url));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Allow Claude");
    expect(html).not.toContain("test-mcp-token");
  });
});

describe("lazy MCP auth", () => {
  beforeEach(() => {
    setRequiredEnv();
  });

  it("treats tools/call as protected and initialize/tools.list as public", () => {
    expect(callsProtectedTool({ method: "tools/call", params: { name: "ga4_run_report" } })).toBe(
      true,
    );
    expect(callsProtectedTool(undefined, "tools/call")).toBe(true);
    expect(callsProtectedTool({ method: "initialize" })).toBe(false);
    expect(callsProtectedTool({ method: "tools/list" })).toBe(false);
  });

  it("returns 401 with WWW-Authenticate for an unauthenticated tool call", async () => {
    const response = unauthorizedToolCallResponse();
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(wwwAuthenticateHeader());
    expect(response.headers.get("www-authenticate")).toContain(
      "/.well-known/oauth-protected-resource/ga4mcp",
    );

    const handler = createGa4McpHandler();
    const gated = await handler(
      new Request("http://localhost:3000/ga4mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "ga4_list_properties", arguments: {} },
        }),
      }),
    );
    expect(gated.status).toBe(401);
    expect(gated.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it("allows initialize without a token and accepts a static bearer token", async () => {
    const handler = createGa4McpHandler();
    const listed = await handler(
      new Request("http://localhost:3000/ga4mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(listed.status).not.toBe(401);
    expect(listed.headers.get("content-type")).toContain("application/json");

    const jsonOnly = await handler(
      new Request("http://localhost:3000/ga4mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );
    expect(jsonOnly.status).toBe(200);
    expect(jsonOnly.headers.get("content-type")).toContain("application/json");

    const probe = await handler(new Request("http://localhost:3000/ga4mcp", { method: "GET" }));
    expect(probe.status).toBe(200);
    expect(probe.headers.get("content-type")).toContain("text/event-stream");

    const req = new Request("http://localhost:3000/ga4mcp", {
      headers: { Authorization: "Bearer test-mcp-token" },
    });
    await expect(verifyMcpToken(req)).resolves.toMatchObject({
      clientId: "personal-operator",
    });
    await expect(isAuthorizedToken("test-mcp-token")).resolves.toBe(true);
    await expect(isAuthorizedToken(issueAccessToken({ clientId: "dcr.test" }))).resolves.toBe(true);
  });
});

describe("CIMD fetch", () => {
  beforeEach(() => {
    setRequiredEnv();
    vi.unstubAllGlobals();
  });

  it("accepts Claude client IDs without fetching their metadata document", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = await resolveClient("https://claude.ai/oauth/claude-client-metadata");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.displayHost).toBe("claude.ai");
    expect(isRedirectAllowed(client, CLAUDE_AI_CALLBACK)).toBe(true);
  });

  it("accepts a self-referential client_id metadata document", async () => {
    const clientId = "https://example.com/oauth/client-metadata";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            client_id: clientId,
            redirect_uris: [CLAUDE_AI_CALLBACK],
            token_endpoint_auth_method: "none",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const client = await resolveClient(clientId);
    expect(client.displayHost).toBe("example.com");
    expect(isRedirectAllowed(client, CLAUDE_AI_CALLBACK)).toBe(true);
  });
});
