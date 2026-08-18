const STATE_COOKIE = "ga4_oauth_state";
const VERIFIER_COOKIE = "ga4_oauth_verifier";
const MAX_AGE_SECONDS = 10 * 60;

function cookieBase(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure ? "; Secure" : ""}`;
}

export function oauthCookieHeaders(params: {
  state: string;
  verifier: string;
  secure: boolean;
}): string[] {
  const base = cookieBase(params.secure);
  return [
    `${STATE_COOKIE}=${encodeURIComponent(params.state)}; ${base}`,
    `${VERIFIER_COOKIE}=${encodeURIComponent(params.verifier)}; ${base}`,
  ];
}

export function clearOAuthCookieHeaders(secure: boolean): string[] {
  const expired = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
  return [`${STATE_COOKIE}=; ${expired}`, `${VERIFIER_COOKIE}=; ${expired}`];
}

export function readOAuthCookies(req: Request): {
  state?: string;
  verifier?: string;
} {
  const cookie = req.headers.get("cookie");
  if (!cookie) {
    return {};
  }

  const values = Object.fromEntries(
    cookie.split(";").map((part) => {
      const [name, ...rest] = part.trim().split("=");
      return [name, decodeURIComponent(rest.join("="))];
    }),
  );

  return {
    state: values[STATE_COOKIE],
    verifier: values[VERIFIER_COOKIE],
  };
}

export function requestIsHttps(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() === "https";
  }
  return new URL(req.url).protocol === "https:";
}
