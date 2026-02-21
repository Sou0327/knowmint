import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".km");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

/** フェッチタイムアウト (ms) */
const FETCH_TIMEOUT_MS = 30_000;

export interface KmConfig {
  apiKey: string;
  baseUrl: string;
}

function fatal(msg: string): never {
  process.stderr.write(`[km-mcp] ${msg}\n`);
  process.exit(1);
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
    fatal(`Invalid base URL: "${cleaned}"`);
  }

  if (parsed.username || parsed.password) {
    fatal("Base URL must not contain credentials (user:pass@...).");
  }

  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1" ||
    parsed.hostname === "[::1]";

  if (!isLocal && parsed.protocol !== "https:") {
    fatal(`Base URL must use HTTPS for non-localhost hosts. Got: "${parsed.protocol}//..."`);
  }

  return parsed.origin; // scheme + host + port のみ
}

/**
 * apiKey を検証する。km_<64 hex> 形式のみ許可。
 */
function validateApiKey(raw: unknown): string {
  if (typeof raw !== "string") {
    fatal("API key must be a string. Set KM_API_KEY env or run `km login`.");
  }
  if (!/^km_[a-f0-9]{64}$/i.test(raw)) {
    fatal("API key format is invalid (expected km_<64 hex chars>).");
  }
  return raw;
}

export async function loadConfig(): Promise<KmConfig> {
  let fileConfig: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      fileConfig = parsed as Record<string, unknown>;
    }
  } catch {
    fileConfig = {};
  }

  const rawKey = process.env["KM_API_KEY"] ?? fileConfig["apiKey"] ?? null;
  if (!rawKey) {
    fatal("No API key configured. Set KM_API_KEY env var, or run `km login`.");
  }

  const apiKey = validateApiKey(rawKey);
  const rawUrl = process.env["KM_BASE_URL"] ?? fileConfig["baseUrl"] ?? DEFAULT_BASE_URL;
  const baseUrl = validateBaseUrl(rawUrl);

  return { apiKey, baseUrl };
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
 * サーバーエラーメッセージをサニタイズする。
 * JSON 応答内の error.message / message フィールドのみ使用し、
 * 生テキスト（HTMLスタックトレース等）は返さない。
 */
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
  // 親シグナルがあれば連鎖
  signal?.addEventListener("abort", () => controller.abort());
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

export async function apiRequest<T>(
  config: KmConfig,
  apiPath: string,
  method: string = "GET",
  body?: unknown
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
  apiPath: string
): Promise<{ data: T[]; pagination: unknown }> {
  const url = `${config.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers = buildHeaders(config);
  const { signal, cleanup } = withTimeout();

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

export interface PublishInput {
  title: string;
  description: string;
  content_type: string;
  content: string;
  price_sol?: number;
  price_usdc?: number;
  tags?: string[];
}

export async function createAndPublishKnowledge(
  config: KmConfig,
  input: PublishInput
): Promise<unknown> {
  type CreatedItem = { id: string };
  const created = await apiRequest<CreatedItem>(config, "/api/v1/knowledge", "POST", {
    title: input.title,
    description: input.description,
    content_type: input.content_type,
    full_content: input.content,
    preview_content: input.content.slice(0, 280),
    price_sol: input.price_sol ?? null,
    price_usdc: input.price_usdc ?? null,
    tags: input.tags ?? [],
  });

  return apiRequest<unknown>(
    config,
    `/api/v1/knowledge/${encodeURIComponent(created.id)}/publish`,
    "POST"
  );
}
