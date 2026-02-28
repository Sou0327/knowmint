import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(os.homedir(), ".km");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_BASE_URL = "https://knowmint.shop";

/** フェッチタイムアウト (ms) */
const FETCH_TIMEOUT_MS = 30_000;

export interface KmConfig {
  apiKey: string | null;
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      fatal(`~/.km/config.json is not valid JSON. Please fix or delete it and run \`km login\` again.`);
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      fileConfig = parsed as Record<string, unknown>;
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    // ENOENT: config file not yet created — fall through to env-only mode
  }

  const rawKey = process.env["KM_API_KEY"] ?? fileConfig["apiKey"] ?? null;

  // apiKey が未設定でも起動可能 (km_register / km_wallet_login で後から取得)
  let apiKey: string | null = null;
  if (rawKey) {
    apiKey = validateApiKey(rawKey);
  }

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
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  return headers;
}

/**
 * config を ~/.km/config.json に永続化する。
 */
export async function saveConfig(config: KmConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const data: Record<string, unknown> = { baseUrl: config.baseUrl };
  if (config.apiKey) data["apiKey"] = config.apiKey;
  await fs.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(CONFIG_DIR, 0o700);
  await fs.chmod(CONFIG_PATH, 0o600);
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // 親シグナルが既に aborted なら即時中断
  if (signal?.aborted) {
    controller.abort(signal.reason);
  }
  // 親シグナルがあれば連鎖 (cleanup でリスナー解除してメモリリーク防止)
  const onAbort = () => controller.abort();
  if (signal && !signal.aborted) {
    signal.addEventListener("abort", onAbort);
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
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
  extraHeaders?: Record<string, string>
): Promise<T | PaymentRequiredResponse> {
  requireApiKey(config);
  const url = `${config.baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers: Record<string, string> = { ...buildHeaders(config), ...extraHeaders };
  const { signal, cleanup } = withTimeout();

  try {
    const response = await fetch(url, { method: "GET", headers, signal });

    if (response.status === 402) {
      const text = await response.text();
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

function requireApiKey(config: KmConfig): void {
  if (!config.apiKey) {
    throw new KmApiError(
      "No API key configured. Run km_register or km_wallet_login first.",
      null,
      "no_api_key"
    );
  }
}

/**
 * 認証不要 (public) エンドポイントへのリクエスト。
 * Authorization ヘッダーを付けない。
 */
export async function apiRequestPublic<T>(
  baseUrl: string,
  apiPath: string,
  method: string = "POST",
  body?: unknown
): Promise<T> {
  const url = `${baseUrl}${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  const { signal, cleanup } = withTimeout();

  try {
    const init: RequestInit = { method, headers, signal };
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

export async function apiRequest<T>(
  config: KmConfig,
  apiPath: string,
  method: string = "GET",
  body?: unknown
): Promise<T> {
  requireApiKey(config);
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
  requireApiKey(config);
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
