import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { AppError, mapGoogleError } from "@/lib/errors";
import { GA4_READONLY_SCOPE, getConfig } from "@/lib/config";
import { readRefreshTokenFromEnv } from "@/google/tokens";

const STATE_TTL_MS = 10 * 60 * 1000;

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface SignedOAuthState {
  nonce: string;
  exp: number;
}

export function createOAuthClient(): OAuth2Client {
  const config = getConfig();
  return new OAuth2Client({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: config.googleRedirectUri,
  });
}

export function createPkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function signOAuthState(state: SignedOAuthState, secret = getConfig().oauthStateSecret): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(
  value: string,
  secret = getConfig().oauthStateSecret,
): SignedOAuthState {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    throw new AppError("OAuth state is invalid.", "unauthorized", 401);
  }

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new AppError("OAuth state is invalid.", "unauthorized", 401);
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedOAuthState;
  if (!parsed.nonce || typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
    throw new AppError("OAuth state has expired. Start the Google authorization flow again.", "unauthorized", 401);
  }
  return parsed;
}

export function createSignedOAuthState(): string {
  return signOAuthState({
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  });
}

export function buildGoogleAuthUrl(params: {
  state: string;
  codeChallenge: string;
}): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GA4_READONLY_SCOPE],
    include_granted_scopes: false,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });
}

export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
}): Promise<{ refreshToken: string }> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken({
    code: params.code,
    codeVerifier: params.codeVerifier,
  });

  if (!tokens.refresh_token) {
    throw new AppError(
      "Google did not return a refresh token. Revoke this app in Google Account permissions and authorize again.",
      "revoked",
      400,
    );
  }

  return { refreshToken: tokens.refresh_token };
}

export async function getAuthorizedClient(): Promise<OAuth2Client> {
  const refreshToken = readRefreshTokenFromEnv();
  if (!refreshToken) {
    throw new AppError(
      "Google account is not connected. Complete the OAuth authorization flow first.",
      "not_connected",
      401,
    );
  }

  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  try {
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) {
      throw new AppError(
        "Google account is not connected. Complete the OAuth authorization flow first.",
        "not_connected",
        401,
      );
    }
    return client;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw mapGoogleError(error);
  }
}

export async function refreshAccessToken(): Promise<string> {
  const client = await getAuthorizedClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) {
    throw new AppError(
      "Google authorization has expired or been revoked. Complete the OAuth authorization flow again.",
      "revoked",
      401,
    );
  }
  return accessToken.token;
}
