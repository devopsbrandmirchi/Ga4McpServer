import { hasStoredRefreshToken } from "@/google/tokens";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const baseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/+$/, "");
  const mcpUrl = baseUrl ? `${baseUrl}/ga4mcp` : "/ga4mcp";
  const googleCallback = baseUrl
    ? `${baseUrl}/oauth/google/callback`
    : "/oauth/google/callback";
  const googleConnected = hasStoredRefreshToken();

  return (
    <main
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        maxWidth: "42rem",
        margin: "3rem auto",
        padding: "0 1.25rem",
        lineHeight: 1.5,
      }}
    >
      <h1>GA4 Analytics MCP</h1>
      <p>
        Personal Google Analytics 4 connector for Claude.ai Custom Connectors.
        This is not a multi-user application.
      </p>
      <ul>
        <li>
          Claude.ai connector URL: <code>{mcpUrl}</code>
        </li>
        <li>
          Google OAuth callback: <code>{googleCallback}</code>
        </li>
        <li>
          Google connected: <strong>{googleConnected ? "yes" : "no"}</strong>
        </li>
      </ul>
      <p>
        <a href="/oauth/google">Connect Google account</a>
        {" · "}
        <a href="/health">Health</a>
      </p>
      <p style={{ color: "#666" }}>
        Claude.ai authenticates with MCP OAuth (not Google). Google OAuth only
        authorizes this server to read your GA4 properties. Disable Vercel
        Deployment Protection on production so Anthropic can reach{" "}
        <code>/ga4mcp</code>.
      </p>
    </main>
  );
}
