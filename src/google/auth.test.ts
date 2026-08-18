import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { setRequiredEnv } from "@/test/env";

const getToken = vi.fn();
const getAccessToken = vi.fn();
const generateAuthUrl = vi.fn(
  (opts: { state: string; code_challenge: string }) =>
    `https://accounts.google.com/o/oauth2/v2/auth?state=${opts.state}&code_challenge=${opts.code_challenge}`,
);
const setCredentials = vi.fn();

vi.mock("google-auth-library", () => ({
  CodeChallengeMethod: { S256: "S256" },
  OAuth2Client: class {
    generateAuthUrl = generateAuthUrl;
    getToken = getToken;
    getAccessToken = getAccessToken;
    setCredentials = setCredentials;
  },
}));

describe("Google OAuth helpers", () => {
  beforeEach(() => {
    setRequiredEnv();
    vi.clearAllMocks();
  });

  it("builds a Google authorization URL with PKCE and the GA4 readonly scope", async () => {
    const { buildGoogleAuthUrl, createPkcePair, createSignedOAuthState } = await import(
      "@/google/auth"
    );
    const { challenge } = createPkcePair();
    const state = createSignedOAuthState();
    const url = buildGoogleAuthUrl({ state, codeChallenge: challenge });

    expect(generateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/analytics.readonly"],
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    );
    expect(url).toContain("accounts.google.com");
  });

  it("verifies signed OAuth state and rejects tampering", async () => {
    const { createSignedOAuthState, verifyOAuthState } = await import("@/google/auth");
    const state = createSignedOAuthState();
    expect(verifyOAuthState(state).nonce).toBeTruthy();
    expect(() => verifyOAuthState(`${state}tampered`)).toThrow(AppError);
  });

  it("exchanges an authorization code for a refresh token", async () => {
    getToken.mockResolvedValue({ tokens: { refresh_token: "1//refresh" } });
    const { exchangeAuthorizationCode } = await import("@/google/auth");
    await expect(
      exchangeAuthorizationCode({ code: "auth-code", codeVerifier: "verifier" }),
    ).resolves.toEqual({ refreshToken: "1//refresh" });
  });

  it("refreshes access tokens from the stored refresh token", async () => {
    setRequiredEnv({ GOOGLE_REFRESH_TOKEN: "1//refresh" });
    getAccessToken.mockResolvedValue({ token: "ya29.access" });
    const { refreshAccessToken } = await import("@/google/auth");
    await expect(refreshAccessToken()).resolves.toBe("ya29.access");
    expect(setCredentials).toHaveBeenCalledWith({ refresh_token: "1//refresh" });
  });

  it("maps a revoked refresh token", async () => {
    setRequiredEnv({ GOOGLE_REFRESH_TOKEN: "1//refresh" });
    getAccessToken.mockRejectedValue(new Error("invalid_grant: Token has been expired or revoked."));
    const { refreshAccessToken } = await import("@/google/auth");
    await expect(refreshAccessToken()).rejects.toMatchObject({ code: "revoked" });
  });
});
