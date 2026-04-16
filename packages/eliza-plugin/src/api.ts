import type { IAgentRuntime } from "@elizaos/core";

import {
  apiRequest as sdkApiRequest,
  apiRequestPaginated as sdkApiRequestPaginated,
  apiRequestWithPayment as sdkApiRequestWithPayment,
  type PaginationMeta as SdkPaginationMeta,
  type PaymentRequiredResponse as SdkPaymentRequiredResponse,
} from "@knowmint/sdk/internal";
import {
  validateBaseUrl as sdkValidateBaseUrl,
  validateApiKey as sdkValidateApiKey,
} from "@knowmint/sdk/validate";
import { KmApiError } from "@knowmint/sdk";

const DEFAULT_BASE_URL = "https://knowmint.shop";

export interface KmConfig {
  apiKey: string;
  baseUrl: string;
}

// KmApiError を SDK 由来として再エクスポート (P-5 重複解消)
export { KmApiError };

/**
 * ElizaOS runtime から設定を読み込む。SDK 側の validateBaseUrl/validateApiKey
 * を使い、credentials 禁止・HTTPS 強制・API キー形式チェックを統一する。
 */
export function loadConfigFromRuntime(runtime: IAgentRuntime): KmConfig {
  const rawKey = runtime.getSetting("KM_API_KEY");
  if (!rawKey || typeof rawKey !== "string") {
    throw new Error("KM_API_KEY is not configured. Set it in your agent character settings.");
  }

  const apiKey = sdkValidateApiKey(rawKey);
  const rawUrl = runtime.getSetting("KM_BASE_URL");
  const baseUrl = sdkValidateBaseUrl(
    typeof rawUrl === "string" ? rawUrl : DEFAULT_BASE_URL,
    { defaultBaseUrl: DEFAULT_BASE_URL }
  );

  return { apiKey, baseUrl };
}

/** x402 HTTP 402 Payment Required レスポンスの型 (SDK から再エクスポート) */
export type PaymentRequiredResponse = SdkPaymentRequiredResponse;

/** Pagination meta (SDK 由来の正確な型、P-9 解消) */
export type PaginationMeta = SdkPaginationMeta;

/**
 * X-PAYMENT ヘッダーを付けてリクエストし、HTTP 402 を特別処理する。
 * 402 の場合は PaymentRequiredResponse を返す (throw しない)。
 */
export async function apiRequestWithPayment<T>(
  config: KmConfig,
  apiPath: string,
  extraHeaders?: Record<string, string>,
): Promise<T | PaymentRequiredResponse> {
  return sdkApiRequestWithPayment<T>(config.baseUrl, config.apiKey, apiPath, {
    extraHeaders,
  });
}

/** 認証付き単一レスポンス API リクエスト。 */
export async function apiRequest<T>(
  config: KmConfig,
  apiPath: string,
  method: string = "GET",
  body?: unknown,
): Promise<T> {
  return sdkApiRequest<T>(config.baseUrl, config.apiKey, apiPath, method, body);
}

/** 認証付きページネーション API リクエスト。 */
export async function apiRequestPaginated<T>(
  config: KmConfig,
  apiPath: string,
): Promise<{ data: T[]; pagination: PaginationMeta }> {
  return sdkApiRequestPaginated<T>(config.baseUrl, config.apiKey, apiPath);
}
