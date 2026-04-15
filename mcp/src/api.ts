import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  apiRequest as sdkApiRequest,
  apiRequestPaginated as sdkApiRequestPaginated,
  apiRequestPublic as sdkApiRequestPublic,
  apiRequestWithPayment as sdkApiRequestWithPayment,
  type PaginationMeta as SdkPaginationMeta,
  type PaymentRequiredResponse as SdkPaymentRequiredResponse,
} from "@knowledge-market/sdk/internal";
import {
  validateBaseUrl as sdkValidateBaseUrl,
  validateApiKey as sdkValidateApiKey,
} from "@knowledge-market/sdk/validate";
import { KmApiError } from "@knowledge-market/sdk";

const CONFIG_DIR = path.join(os.homedir(), ".km");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_BASE_URL = "https://knowmint.shop";

export interface KmConfig {
  apiKey: string | null;
  baseUrl: string;
}

function fatal(msg: string): never {
  process.stderr.write(`[km-mcp] ${msg}\n`);
  process.exit(1);
}

/**
 * baseUrl を検証・正規化する。SDK の validateBaseUrl を MCP の fatal 挙動で
 * ラップする。SDK 側で credentials/HTTPS チェック・origin 化を実施。
 */
function validateBaseUrl(raw: unknown): string {
  const cleaned = typeof raw === "string" ? raw : DEFAULT_BASE_URL;
  try {
    return sdkValidateBaseUrl(cleaned, { defaultBaseUrl: DEFAULT_BASE_URL });
  } catch (e) {
    fatal((e as Error).message);
  }
}

/**
 * apiKey を検証する。km_<64 hex> 形式のみ許可。MCP はユーザーに即時中断を示すため
 * fatal する。
 */
function validateApiKey(raw: unknown): string {
  try {
    return sdkValidateApiKey(raw);
  } catch (e) {
    fatal((e as Error).message);
  }
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

// SDK の KmApiError を唯一の実装として再エクスポート (P-5 重複解消)。
export { KmApiError };

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

function requireApiKey(config: KmConfig): string {
  if (!config.apiKey) {
    throw new KmApiError(
      "No API key configured. Run km_register or km_wallet_login first.",
      null,
      "no_api_key"
    );
  }
  return config.apiKey;
}

/** SDK の PaymentRequiredResponse を MCP が再エクスポート。 */
export type PaymentRequiredResponse = SdkPaymentRequiredResponse;

/** SDK の PaginationMeta を MCP が再エクスポート。 */
export type PaginationMeta = SdkPaginationMeta;

/**
 * X-PAYMENT ヘッダーを付けてリクエストし、HTTP 402 を特別処理する。
 * 402 の場合は PaymentRequiredResponse を返す (throw しない)。
 */
export async function apiRequestWithPayment<T>(
  config: KmConfig,
  apiPath: string,
  extraHeaders?: Record<string, string>
): Promise<T | PaymentRequiredResponse> {
  const apiKey = requireApiKey(config);
  return sdkApiRequestWithPayment<T>(config.baseUrl, apiKey, apiPath, {
    extraHeaders,
    moveApiKeyOnAuthOverride: true,
  });
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
  return sdkApiRequestPublic<T>(baseUrl, apiPath, method, body);
}

/** 認証付きの単一レスポンス API リクエスト。 */
export async function apiRequest<T>(
  config: KmConfig,
  apiPath: string,
  method: string = "GET",
  body?: unknown
): Promise<T> {
  const apiKey = requireApiKey(config);
  return sdkApiRequest<T>(config.baseUrl, apiKey, apiPath, method, body);
}

/** 認証付きのページネーション API リクエスト。 */
export async function apiRequestPaginated<T>(
  config: KmConfig,
  apiPath: string
): Promise<{ data: T[]; pagination: PaginationMeta }> {
  const apiKey = requireApiKey(config);
  return sdkApiRequestPaginated<T>(config.baseUrl, apiKey, apiPath);
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
