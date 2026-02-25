import type { IAgentRuntime } from "@elizaos/core";

const DEFAULT_BASE_URL = "https://knowmint.shop";
const FETCH_TIMEOUT_MS = 30_000;
/** Max response body size (2 MB) to prevent memory exhaustion from oversized responses */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface KmConfig {
  apiKey: string;
  baseUrl: string;
}

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
function validateBaseUrl(raw: unknown): string {
  const cleaned =
    typeof raw === "string" && raw.trim() ? raw.trim() : DEFAULT_BASE_URL;

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

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Base URL must use HTTP(S). Got: "${parsed.protocol}//..."`);
  }

  if (!isLocal && parsed.protocol !== "https:") {
    throw new Error(`Base URL must use HTTPS for non-localhost hosts. Got: "${parsed.protocol}//..."`);
  }

  return parsed.origin;
}

/**
 * apiKey を検証する。km_<64 hex> 形式のみ許可。
 */
function validateApiKey(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new Error("API key must be a string. Set KM_API_KEY in your agent character settings.");
  }
  if (!/^km_[a-f0-9]{64}$/i.test(raw)) {
    throw new Error("API key format is invalid (expected km_<64 hex chars>).");
  }
  return raw;
}

/**
 * ElizaOS runtime から設定を読み込む。
 */
export function loadConfigFromRuntime(runtime: IAgentRuntime): KmConfig {
  const rawKey = runtime.getSetting("KM_API_KEY");
  if (!rawKey || typeof rawKey !== "string") {
    throw new Error("KM_API_KEY is not configured. Set it in your agent character settings.");
  }

  const apiKey = validateApiKey(rawKey);
  const rawUrl = runtime.getSetting("KM_BASE_URL");
  const baseUrl = validateBaseUrl(typeof rawUrl === "string" ? rawUrl : DEFAULT_BASE_URL);

  return { apiKey, baseUrl };
}

function sanitizeServerError(status: number, json: unknown): string {
  const obj = json as Record<string, unknown> | null;
  const errObj = obj?.["error"] as Record<string, unknown> | undefined;

  const serverMsg =
    (typeof errObj?.["message"] === "string" ? errObj["message"] : null) ??
    (typeof obj?.["message"] === "string" ? obj["message"] : null);

  return serverMsg ?? `Request failed with status ${status}`;
}

function buildHeaders(config: KmConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
  };
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort());
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

async function readResponseText(response: Response): Promise<string> {
  // Early reject if Content-Length is declared and exceeds limit
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new KmApiError(`Response too large (${contentLength} bytes)`, response.status);
  }

  // Stream-based bounded read to prevent buffering oversized bodies
  const body = response.body;
  if (body) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          reader.cancel().then(() => {}, () => {});
          throw new KmApiError(`Response too large (>${MAX_RESPONSE_BYTES} bytes)`, response.status);
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

  // Fallback for environments without ReadableStream body
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new KmApiError(`Response too large`, response.status);
  }
  return text;
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

/** x402 HTTP 402 Payment Required レスポンスの型 */
export interface PaymentRequiredResponse {
  payment_required: true;
  x402Version?: number;
  accepts?: unknown[];
  error?: string;
}

/**
 * X-PAYMENT ヘッダーを付けてリクエストし、HTTP 402 を特別処理する。
 * 402 の場合は PaymentRequiredResponse を返す (throw しない)。
 */
export async function apiRequestWithPayment<T>(
  config: KmConfig,
  apiPath: string,
  extraHeaders?: Record<string, string>,
): Promise<T | PaymentRequiredResponse> {
  const url = `${config.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers: Record<string, string> = { ...buildHeaders(config), ...extraHeaders };
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
        accepts: Array.isArray(body["accepts"]) ? body["accepts"] : [],
        error: typeof body["error"] === "string" ? body["error"] : undefined,
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

export async function apiRequest<T>(
  config: KmConfig,
  apiPath: string,
  method: string = "GET",
  body?: unknown,
): Promise<T> {
  const url = `${config.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers = buildHeaders(config);
  const { signal, cleanup } = withTimeout();

  try {
    const init: RequestInit = { method, headers, signal };
    if (body !== undefined) {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
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

export async function apiRequestPaginated<T>(
  config: KmConfig,
  apiPath: string,
): Promise<{ data: T[]; pagination: unknown }> {
  const url = `${config.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers = buildHeaders(config);
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
