import type { KnowMintConfig, PaymentRequiredResponse, X402Accept } from "./types.js";

const DEFAULT_BASE_URL = "https://knowmint.shop";
const FETCH_TIMEOUT_MS = 30_000;
const API_KEY_RE = /^km_[a-f0-9]{64}$/i;

export class KmApiError extends Error {
  readonly status: number | null;
  readonly code: string | null;

  constructor(message: string, status: number | null = null, code: string | null = null) {
    super(message);
    this.name = "KmApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * baseUrl を検証・正規化する。
 * - userinfo (credentials) を持つ URL を拒否
 * - localhost/127.0.0.1/::1 以外では HTTPS を強制
 * - origin のみ返す (path/query/fragment を除去)
 */
function validateBaseUrl(raw: string | undefined): string {
  const cleaned = raw?.trim() || DEFAULT_BASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error(`Invalid base URL: "${cleaned}"`);
  }

  if (parsed.username || parsed.password) {
    throw new Error("Base URL must not contain credentials (user:pass@...).");
  }

  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1" ||
    parsed.hostname === "[::1]";

  if (isLocal) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(
        `Base URL must use HTTP or HTTPS. Got: "${parsed.protocol}//..."`
      );
    }
  } else if (parsed.protocol !== "https:") {
    throw new Error(
      `Base URL must use HTTPS for non-localhost hosts. Got: "${parsed.protocol}//..."`
    );
  }

  return parsed.origin;
}

function validateApiKey(raw: string): string {
  if (!API_KEY_RE.test(raw)) {
    throw new Error("API key format is invalid (expected km_<64 hex chars>).");
  }
  return raw;
}

/** Max length for sanitized text fields */
const MAX_ERROR_MSG_LEN = 256;
/** Max response body size (5 MB) to prevent memory exhaustion */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/** Strip HTML tags, ANSI escapes, control chars, and truncate */
function sanitizeText(raw: string): string {
  const cleaned = raw
    .replace(/<[^>]*>/g, "")
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  return cleaned.length > MAX_ERROR_MSG_LEN
    ? cleaned.slice(0, MAX_ERROR_MSG_LEN) + "..."
    : cleaned;
}

function sanitizeServerError(status: number, json: unknown): string {
  const obj = json as Record<string, unknown> | null;
  const errObj = obj?.["error"] as Record<string, unknown> | undefined;

  const serverMsg =
    (typeof errObj?.["message"] === "string" ? errObj["message"] : null) ??
    (typeof obj?.["message"] === "string" ? obj["message"] : null);

  if (!serverMsg) return `Request failed with status ${status}`;
  return sanitizeText(serverMsg);
}

function withTimeout(): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

/** Read response body with size limit to prevent memory exhaustion */
async function readResponseText(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new KmApiError(
      `Response too large (${contentLength} bytes, max ${MAX_RESPONSE_BYTES})`,
      response.status
    );
  }

  // Stream-read with size cap when content-length is absent/untrusted
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        reader.cancel().then(() => {}, () => {});
        throw new KmApiError(
          `Response body exceeded ${MAX_RESPONSE_BYTES} bytes`,
          response.status
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await readResponseText(response);
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const code =
      ((json as Record<string, unknown> | null)?.["error"] as Record<string, unknown> | undefined)
        ?.["code"] as string | undefined ?? null;
    throw new KmApiError(sanitizeServerError(response.status, json), response.status, code);
  }

  const result = json as { success: boolean; data: T } | null;
  if (!result || result.success !== true) {
    throw new KmApiError("Unexpected API response shape");
  }
  return result.data;
}

/** ライブラリ安全な KnowMint API クライアント (process.exit なし) */
export class KmApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: KnowMintConfig) {
    this.apiKey = validateApiKey(config.apiKey);
    this.baseUrl = validateBaseUrl(config.baseUrl);
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
  }

  private buildUrl(apiPath: string): string {
    return `${this.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  }

  async get<T>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    const headers = this.buildHeaders();
    const { signal, cleanup } = withTimeout();

    try {
      const response = await fetch(url, { method: "GET", headers, signal });
      return await parseResponse<T>(response);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        throw new KmApiError(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, null);
      }
      throw e;
    } finally {
      cleanup();
    }
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const headers: Record<string, string> = this.buildHeaders();
    const { signal, cleanup } = withTimeout();

    try {
      const init: RequestInit = { method: "POST", headers, signal };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      const response = await fetch(url, init);
      return await parseResponse<T>(response);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        throw new KmApiError(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, null);
      }
      throw e;
    } finally {
      cleanup();
    }
  }

  async getPaginated<T>(path: string): Promise<{ data: T[]; pagination: unknown }> {
    const url = this.buildUrl(path);
    const headers = this.buildHeaders();
    const { signal, cleanup } = withTimeout();

    try {
      const response = await fetch(url, { method: "GET", headers, signal });
      const text = await readResponseText(response);
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!response.ok) {
        throw new KmApiError(sanitizeServerError(response.status, json), response.status);
      }

      const result = json as { success: boolean; data: T[]; pagination: unknown } | null;
      if (!result || result.success !== true) {
        throw new KmApiError("Unexpected API response shape");
      }
      return { data: result.data, pagination: result.pagination };
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        throw new KmApiError(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, null);
      }
      throw e;
    } finally {
      cleanup();
    }
  }

  async getWithPayment<T>(
    path: string,
    extraHeaders?: Record<string, string>
  ): Promise<T | PaymentRequiredResponse> {
    const url = this.buildUrl(path);
    const headers: Record<string, string> = { ...this.buildHeaders(), ...extraHeaders };
    const { signal, cleanup } = withTimeout();

    try {
      const response = await fetch(url, { method: "GET", headers, signal });

      if (response.status === 402) {
        const text = await readResponseText(response);
        let json: unknown = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = null; }
        const body = (json ?? {}) as Record<string, unknown>;
        return {
          payment_required: true,
          x402Version: typeof body["x402Version"] === "number" ? body["x402Version"] : undefined,
          accepts: Array.isArray(body["accepts"])
            ? (body["accepts"] as unknown[]).filter((a): a is X402Accept => {
                if (a == null || typeof a !== "object") return false;
                const r = a as Record<string, unknown>;
                return (
                  typeof r["payTo"] === "string" &&
                  typeof r["maxAmountRequired"] === "string" &&
                  typeof r["asset"] === "string" &&
                  typeof r["scheme"] === "string" &&
                  typeof r["network"] === "string" &&
                  typeof r["resource"] === "string" &&
                  typeof r["description"] === "string" &&
                  typeof r["mimeType"] === "string" &&
                  typeof r["maxTimeoutSeconds"] === "number"
                );
              })
            : [],
          error: typeof body["error"] === "string"
            ? sanitizeText(body["error"])
            : undefined,
        } satisfies PaymentRequiredResponse;
      }

      return await parseResponse<T>(response);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        throw new KmApiError(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`, null);
      }
      throw e;
    } finally {
      cleanup();
    }
  }
}
