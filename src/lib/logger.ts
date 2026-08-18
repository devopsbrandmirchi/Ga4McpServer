const SECRET_KEYS = [
  "access_token",
  "refresh_token",
  "id_token",
  "authorization",
  "authorization_code",
  "code",
  "client_secret",
  "mcp_auth_token",
  "oauth_state_secret",
] as const;

const SECRET_PATTERNS = [
  /ya29\.[a-zA-Z0-9._~-]+/g,
  /1\/\/[a-zA-Z0-9._~-]+/g,
  /4\/[0-9A-Za-z._~-]+/g,
];

function redactString(value: string): string {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

function redactUnknown(value: unknown, key?: string): unknown {
  if (key && SECRET_KEYS.includes(key.toLowerCase() as (typeof SECRET_KEYS)[number])) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      result[entryKey] = redactUnknown(entryValue, entryKey);
    }
    return result;
  }
  return value;
}

function write(level: "info" | "warn" | "error", message: string, extra?: unknown): void {
  const payload =
    extra === undefined
      ? message
      : `${message} ${JSON.stringify(redactUnknown(extra))}`;
  if (level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.info(payload);
}

export const logger = {
  info(message: string, extra?: unknown): void {
    write("info", message, extra);
  },
  warn(message: string, extra?: unknown): void {
    write("warn", message, extra);
  },
  error(message: string, extra?: unknown): void {
    write("error", message, extra);
  },
};
