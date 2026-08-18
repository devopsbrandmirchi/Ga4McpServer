export function setRequiredEnv(overrides: Record<string, string | undefined> = {}): void {
  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/oauth/google/callback";
  process.env.MCP_AUTH_TOKEN = "test-mcp-token";
  process.env.OAUTH_STATE_SECRET = "test-state-secret";
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.VERCEL;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
