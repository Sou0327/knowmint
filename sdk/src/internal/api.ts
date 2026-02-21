import { KmApiError } from "../errors.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * サーバーエラーメッセージをサニタイズする。
 * JSON 応答内の error.message / message フィールドのみ使用し、
 * 生テキスト (HTML スタックトレース等) は返さない。
 */
function sanitizeServerError(status: number, json: unknown): string {
  const obj = json as Record<string, unknown> | null;
  const errObj = obj?.["error"] as Record<string, unknown> | undefined;

  const serverMsg =
    (typeof errObj?.["message"] === "string" ? errObj["message"] : null) ??
    (typeof obj?.["message"] === "string" ? obj["message"] : null);

  return serverMsg ?? `Request failed with status ${status}`;
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}

function withTimeout(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
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
 * 単一レスポンスの API リクエストを行う。
 */
export async function apiRequest<T>(
  baseUrl: string,
  apiKey: string,
  apiPath: string,
  method: string = "GET",
  body?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const url = `${baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers = buildHeaders(apiKey);
  const { signal, cleanup } = withTimeout(timeoutMs);

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
      throw new KmApiError(`Request timed out after ${timeoutMs / 1000}s`, null);
    }
    throw e;
  } finally {
    cleanup();
  }
}

/**
 * ページネーション付きレスポンスの API リクエストを行う。
 */
export async function apiRequestPaginated<T>(
  baseUrl: string,
  apiKey: string,
  apiPath: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{
  data: T[];
  pagination: { total: number; page: number; per_page: number; total_pages: number };
}> {
  const url = `${baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers = buildHeaders(apiKey);
  const { signal, cleanup } = withTimeout(timeoutMs);

  try {
    const response = await fetch(url, { method: "GET", headers, signal });

    const text = await response.text();
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
      pagination: { total: number; page: number; per_page: number; total_pages: number };
    } | null;

    if (!result || result.success !== true) {
      throw new KmApiError("Unexpected API response shape");
    }

    return { data: result.data, pagination: result.pagination };
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") {
      throw new KmApiError(`Request timed out after ${timeoutMs / 1000}s`, null);
    }
    throw e;
  } finally {
    cleanup();
  }
}
