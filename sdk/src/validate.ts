/**
 * Base URL / API key validation helpers shared by every KnowMint client
 * (SDK, MCP, Eliza plugin, AgentKit plugin, CLI).
 *
 * Historically each client had its own `validateBaseUrl` copy with subtle
 * differences — most critically, the SDK version was missing the
 * `username` / `password` rejection check, allowing credential-embedded
 * URLs (`https://user:pass@host/`) to reach outbound requests. This module
 * is the single source of truth.
 */

const API_KEY_RE = /^km_[a-f0-9]{64}$/i;

export interface ValidateBaseUrlOptions {
  /**
   * Default URL used when `raw` is empty/undefined. Callers should pass
   * their package-specific default so that the error messages stay useful.
   */
  defaultBaseUrl?: string;
  /**
   * When true, allow `http:` for localhost/loopback hosts. Non-localhost
   * hosts always require HTTPS. Defaults to true (matching AgentKit/Eliza
   * behaviour); SDK's public client forces HTTPS everywhere via
   * `allowLocalHttp: true` plus the implicit origin fallback.
   */
  allowLocalHttp?: boolean;
}

const DEFAULT_BASE_URL = "https://knowmint.shop";

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

/**
 * Validate and canonicalize a KnowMint base URL.
 *
 * Rules:
 * - Strings are trimmed; empty input falls back to `defaultBaseUrl`
 *   (or `https://knowmint.shop`).
 * - The URL must parse successfully; otherwise throws.
 * - `user:pass@...` credentials are rejected (prevents leaking API keys
 *   through Basic auth, and blocks credential-smuggling SSRF).
 * - Non-localhost hosts MUST use HTTPS (protects Bearer token in transit).
 * - Localhost/loopback hosts may use HTTP when `allowLocalHttp` is true.
 * - Only the origin (scheme + host + port) is returned — path/query/fragment
 *   are stripped so callers cannot accidentally leak context.
 */
export function validateBaseUrl(
  raw: string | undefined,
  opts?: ValidateBaseUrlOptions
): string {
  const fallback = opts?.defaultBaseUrl ?? DEFAULT_BASE_URL;
  const cleaned = typeof raw === "string" && raw.trim() ? raw.trim() : fallback;

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error(`Invalid base URL: "${cleaned}"`);
  }

  if (parsed.username || parsed.password) {
    throw new Error("Base URL must not contain credentials (user:pass@...).");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `Base URL must use HTTP(S). Got: "${parsed.protocol}//..."`
    );
  }

  const isLocal = isLocalHost(parsed.hostname);
  const allowLocalHttp = opts?.allowLocalHttp ?? true;

  if (!isLocal && parsed.protocol !== "https:") {
    throw new Error(
      `Base URL must use HTTPS for non-localhost hosts. Got: "${parsed.protocol}//..."`
    );
  }

  if (isLocal && !allowLocalHttp && parsed.protocol !== "https:") {
    throw new Error(
      `Base URL must use HTTPS (localhost HTTP disabled). Got: "${parsed.protocol}//..."`
    );
  }

  return parsed.origin;
}

/**
 * Validate API key shape (`km_<64 hex>`). Throws on malformed input.
 */
export function validateApiKey(raw: unknown): string {
  if (typeof raw !== "string" || !API_KEY_RE.test(raw)) {
    throw new Error("API key format is invalid (expected km_<64 hex chars>).");
  }
  return raw;
}

/** Return true when `raw` looks like a valid API key. */
export function isValidApiKey(raw: unknown): raw is string {
  return typeof raw === "string" && API_KEY_RE.test(raw);
}
