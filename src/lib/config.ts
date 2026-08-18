export const GA4_READONLY_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";

export interface AppConfig {
  appBaseUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  mcpAuthToken: string;
  googleRefreshToken: string | undefined;
  oauthStateSecret: string;
  mcpTokenSecret: string;
  mcpOAuthClientId: string | undefined;
  mcpOAuthClientSecret: string | undefined;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getConfig(): AppConfig {
  const appBaseUrl = stripTrailingSlash(required("APP_BASE_URL"));
  const mcpAuthToken = required("MCP_AUTH_TOKEN");
  const googleRedirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${appBaseUrl}/oauth/google/callback`;

  return {
    appBaseUrl,
    googleClientId: required("GOOGLE_CLIENT_ID"),
    googleClientSecret: required("GOOGLE_CLIENT_SECRET"),
    googleRedirectUri,
    mcpAuthToken,
    googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN?.trim() || undefined,
    oauthStateSecret:
      process.env.OAUTH_STATE_SECRET?.trim() || mcpAuthToken,
    mcpTokenSecret: process.env.MCP_TOKEN_SECRET?.trim() || mcpAuthToken,
    mcpOAuthClientId: process.env.MCP_OAUTH_CLIENT_ID?.trim() || undefined,
    mcpOAuthClientSecret: process.env.MCP_OAUTH_CLIENT_SECRET?.trim() || undefined,
  };
}

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}
