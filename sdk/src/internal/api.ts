import { KmApiError } from "../errors.js";
import { DEFAULT_MAX_RESPONSE_BYTES, readResponseText } from "./stream.js";

/** Default request timeout applied when callers do not override. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Sanitize server error messages. Only `error.message` / `message` JSON fields
 * are surfaced; raw text (HTML stack traces) is never leaked to callers.
 */
function sanitizeServerError(status: number, json: unknown): string {
  const obj = json as Record<string, unknown> | null;
  const errObj = obj?.["error"] as Record<string, unknown> | undefined;

  const serverMsg =
    (typeof errObj?.["message"] === "string" ? errObj["message"] : null) ??
    (typeof obj?.["message"] === "string" ? obj["message"] : null);

  return serverMsg ?? `Request failed with status ${status}`;
}

function buildHeaders(apiKey: string | null | undefined): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

export interface WithTimeoutResult {
  signal: AbortSignal;
  cleanup: () => void;
}

/**
 * Build an `AbortSignal` that aborts after `timeoutMs` **and** propagates
 * aborts from an optional parent signal.
 *
 * Critical design points:
 * - If the parent signal is already aborted, the inner controller aborts
 *   immediately (preserves the reason when supported).
 * - When the parent signal aborts later, the inner controller aborts.
 * - `cleanup()` clears the timer AND removes the `abort` listener on the
 *   parent to prevent long-running callers (Eliza, MCP servers) from
 *   accumulating listeners over time. This was the P-8 leak.
 */
export function withTimeout(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  parentSignal?: AbortSignal
): WithTimeoutResult {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (parentSignal?.aborted) {
    // Forward reason when the environment exposes it (Node 18+, modern browsers).
    const reason = (parentSignal as AbortSignal & { reason?: unknown }).reason;
    if (reason !== undefined) {
      controller.abort(reason);
    } else {
      controller.abort();
    }
  }

  let onAbort: (() => void) | null = null;
  if (parentSignal && !parentSignal.aborted) {
    onAbort = () => {
      const reason = (parentSignal as AbortSignal & { reason?: unknown }).reason;
      if (reason !== undefined) controller.abort(reason);
      else controller.abort();
    };
    parentSignal.addEventListener("abort", onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (onAbort && parentSignal) {
        parentSignal.removeEventListener("abort", onAbort);
        onAbort = null;
      }
    },
  };
}

/**
 * Parse a `Response` under a byte cap and surface API errors through
 * `KmApiError`. This is the shared parser used by every KnowMint client.
 */
export async function parseResponse<T>(
  response: Response,
  maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES
): Promise<T> {
  const text = await readResponseText(response, maxBytes);
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const code =
      (
        (json as Record<string, unknown> | null)?.["error"] as
          | Record<string, unknown>
          | undefined
      )?.["code"] as string | undefined ?? null;
    throw new KmApiError(sanitizeServerError(response.status, json), response.status, code);
  }

  const result = json as { success: boolean; data: T } | null;
  if (!result || result.success !== true) {
    throw new KmApiError("Unexpected API response shape");
  }
  return result.data;
}

/**
 * Parse a paginated response. Keeps the same size cap + error handling
 * as `parseResponse` while exposing the `pagination` metadata.
 */
export async function parsePaginatedResponse<T>(
  response: Response,
  maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES
): Promise<{ data: T[]; pagination: PaginationMeta }> {
  const text = await readResponseText(response, maxBytes);
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new KmApiError(sanitizeServerError(response.status, json), response.status);
  }

  const result = json as {
    success: boolean;
    data: T[];
    pagination: PaginationMeta;
  } | null;

  if (!result || result.success !== true) {
    throw new KmApiError("Unexpected API response shape");
  }

  return { data: result.data, pagination: result.pagination };
}

/** Shared pagination metadata for KnowMint listings. */
export interface PaginationMeta {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  /** Extra headers to merge into the outgoing request. */
  extraHeaders?: Record<string, string>;
  /** Parent AbortSignal to chain into the internal timeout controller. */
  signal?: AbortSignal;
  /** Timeout override (ms). */
  timeoutMs?: number;
  /** Max response body size (bytes). */
  maxResponseBytes?: number;
}

function buildUrl(baseUrl: string, apiPath: string): string {
  return `${baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
}

function normalizeError(e: unknown, timeoutMs: number): Error {
  if ((e as { name?: string }).name === "AbortError") {
    return new KmApiError(`Request timed out after ${timeoutMs / 1000}s`, null);
  }
  return e as Error;
}

/**
 * Single-response authenticated API request.
 * Supports optional parent AbortSignal + response size cap.
 */
export async function apiRequest<T>(
  baseUrl: string,
  apiKey: string,
  apiPath: string,
  method: string = "GET",
  body?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  extraOptions?: Omit<ApiRequestOptions, "method" | "body" | "timeoutMs">
): Promise<T> {
  const url = buildUrl(baseUrl, apiPath);
  const headers: Record<string, string> = {
    ...buildHeaders(apiKey),
    ...(extraOptions?.extraHeaders ?? {}),
  };
  const { signal, cleanup } = withTimeout(timeoutMs, extraOptions?.signal);

  try {
    const init: RequestInit = { method, headers, signal };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    return await parseResponse<T>(response, extraOptions?.maxResponseBytes);
  } catch (e) {
    throw normalizeError(e, timeoutMs);
  } finally {
    cleanup();
  }
}

/**
 * Paginated authenticated API request (GET). Exposes `pagination` alongside
 * the data array. Returns the properly typed `PaginationMeta`.
 */
export async function apiRequestPaginated<T>(
  baseUrl: string,
  apiKey: string,
  apiPath: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  extraOptions?: Omit<ApiRequestOptions, "method" | "body" | "timeoutMs">
): Promise<{ data: T[]; pagination: PaginationMeta }> {
  const url = buildUrl(baseUrl, apiPath);
  const headers: Record<string, string> = {
    ...buildHeaders(apiKey),
    ...(extraOptions?.extraHeaders ?? {}),
  };
  const { signal, cleanup } = withTimeout(timeoutMs, extraOptions?.signal);

  try {
    const response = await fetch(url, { method: "GET", headers, signal });
    return await parsePaginatedResponse<T>(response, extraOptions?.maxResponseBytes);
  } catch (e) {
    throw normalizeError(e, timeoutMs);
  } finally {
    cleanup();
  }
}

/**
 * Unauthenticated GET/POST request (e.g. `/api/v1/auth/challenge`, `/login`).
 * Used by CLI and MCP `km_register` / `km_wallet_login` flows where the caller
 * does not yet have an API key.
 */
export async function apiRequestPublic<T>(
  baseUrl: string,
  apiPath: string,
  method: string = "POST",
  body?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  extraOptions?: Pick<ApiRequestOptions, "signal" | "maxResponseBytes" | "extraHeaders">
): Promise<T> {
  const url = buildUrl(baseUrl, apiPath);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(extraOptions?.extraHeaders ?? {}),
  };
  const { signal, cleanup } = withTimeout(timeoutMs, extraOptions?.signal);

  try {
    const init: RequestInit = { method, headers, signal };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    return await parseResponse<T>(response, extraOptions?.maxResponseBytes);
  } catch (e) {
    throw normalizeError(e, timeoutMs);
  } finally {
    cleanup();
  }
}

/** x402 / MPP HTTP 402 Payment Required response shape. */
export interface PaymentRequiredResponse {
  payment_required: true;
  x402Version?: number;
  accepts?: unknown[];
  error?: string;
  /** MPP WWW-Authenticate challenge (set when MPP is enabled on the server). */
  mpp_challenge?: string;
}

export interface ApiRequestWithPaymentOptions
  extends Pick<ApiRequestOptions, "signal" | "timeoutMs" | "maxResponseBytes"> {
  /** Extra headers such as `X-PAYMENT` or MPP `Authorization`. */
  extraHeaders?: Record<string, string>;
  /**
   * When true and extra `Authorization` is provided (e.g. MPP Payment
   * credential), the API key is moved to `X-API-Key` so the server's
   * auth middleware still authenticates the caller. Matches MCP behavior.
   */
  moveApiKeyOnAuthOverride?: boolean;
}

/**
 * Authenticated GET that understands HTTP 402 (Payment Required) for both
 * x402 (JSON body) and MPP (WWW-Authenticate header) payment gates.
 * When the server returns 402 the function resolves with a
 * `PaymentRequiredResponse` instead of throwing.
 */
export async function apiRequestWithPayment<T>(
  baseUrl: string,
  apiKey: string,
  apiPath: string,
  options?: ApiRequestWithPaymentOptions
): Promise<T | PaymentRequiredResponse> {
  const url = buildUrl(baseUrl, apiPath);
  const baseHeaders = buildHeaders(apiKey);
  const extraHeaders = options?.extraHeaders;

  if (
    extraHeaders?.["Authorization"] &&
    baseHeaders["Authorization"] &&
    options?.moveApiKeyOnAuthOverride
  ) {
    delete baseHeaders["Authorization"];
    baseHeaders["X-API-Key"] = apiKey;
  }

  const headers: Record<string, string> = { ...baseHeaders, ...extraHeaders };
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { signal, cleanup } = withTimeout(timeoutMs, options?.signal);
  const maxBytes = options?.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

  try {
    const response = await fetch(url, { method: "GET", headers, signal });

    if (response.status === 402) {
      const text = await readResponseText(response, maxBytes);
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      const body = (json ?? {}) as Record<string, unknown>;

      const wwwAuth = response.headers.get("WWW-Authenticate");
      const mppChallenge = wwwAuth?.startsWith("Payment ") ? wwwAuth : undefined;

      return {
        payment_required: true,
        x402Version:
          typeof body["x402Version"] === "number" ? body["x402Version"] : undefined,
        accepts: Array.isArray(body["accepts"]) ? body["accepts"] : [],
        error: typeof body["error"] === "string" ? body["error"] : undefined,
        mpp_challenge: mppChallenge,
      } satisfies PaymentRequiredResponse;
    }

    return await parseResponse<T>(response, maxBytes);
  } catch (e) {
    throw normalizeError(e, timeoutMs);
  } finally {
    cleanup();
  }
}
