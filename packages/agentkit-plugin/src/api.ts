import {
  apiRequest as sdkApiRequest,
  apiRequestPaginated as sdkApiRequestPaginated,
  apiRequestWithPayment as sdkApiRequestWithPayment,
  type PaginationMeta as SdkPaginationMeta,
} from "@knowmint/sdk/internal";
import {
  validateBaseUrl as sdkValidateBaseUrl,
  validateApiKey as sdkValidateApiKey,
} from "@knowmint/sdk/validate";
import { KmApiError } from "@knowmint/sdk";

import type { KnowMintConfig, PaymentRequiredResponse, X402Accept } from "./types.js";

// SDK の KmApiError を唯一の実装として再エクスポート (P-5 重複解消)
export { KmApiError };

/** SDK 由来の pagination 型を再エクスポート */
export type PaginationMeta = SdkPaginationMeta;

const DEFAULT_BASE_URL = "https://knowmint.shop";
/** Max length for sanitized text fields */
const MAX_ERROR_MSG_LEN = 256;

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

/**
 * 402 レスポンスの `accepts` 配列から x402 の必須フィールドが揃ったものだけを抽出する。
 * 生のサーバー応答は信用しない — 型の一致を実行時に検査することで
 * ログインジェクション / 無効ペイロードをダウンストリームへ流さない。
 */
function filterValidAccepts(accepts: unknown[]): X402Accept[] {
  return accepts.filter((a): a is X402Accept => {
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
  });
}

/**
 * ライブラリ安全な KnowMint API クライアント (process.exit なし)。
 * HTTP プリミティブ・URL/API キー検証は SDK に集約されている — このクラスは
 * AgentKit 向けの既存メソッド API を維持するだけの薄い wrapper。
 */
export class KmApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: KnowMintConfig) {
    this.apiKey = sdkValidateApiKey(config.apiKey);
    this.baseUrl = sdkValidateBaseUrl(config.baseUrl, {
      defaultBaseUrl: DEFAULT_BASE_URL,
    });
  }

  /** 内部共通メソッド — GET/POST を1箇所に集約して P-14 の get/getPaginated 二重実装を解消。 */
  private async request<T>(
    path: string,
    method: string,
    body?: unknown
  ): Promise<T> {
    return sdkApiRequest<T>(this.baseUrl, this.apiKey, path, method, body);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, "GET");
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, "POST", body);
  }

  async getPaginated<T>(
    path: string
  ): Promise<{ data: T[]; pagination: PaginationMeta }> {
    return sdkApiRequestPaginated<T>(this.baseUrl, this.apiKey, path);
  }

  async getWithPayment<T>(
    path: string,
    extraHeaders?: Record<string, string>
  ): Promise<T | PaymentRequiredResponse> {
    const result = await sdkApiRequestWithPayment<T>(
      this.baseUrl,
      this.apiKey,
      path,
      { extraHeaders }
    );

    // SDK の PaymentRequiredResponse を AgentKit の型付き X402Accept 配列に絞り込む。
    // `accepts` のサニタイズ / sanitizeText(error) は AgentKit 固有の防御。
    if (isSdkPaymentRequired(result)) {
      return {
        payment_required: true,
        x402Version: result.x402Version,
        accepts: Array.isArray(result.accepts)
          ? filterValidAccepts(result.accepts)
          : [],
        error:
          typeof result.error === "string" ? sanitizeText(result.error) : undefined,
      } satisfies PaymentRequiredResponse;
    }
    return result;
  }
}

function isSdkPaymentRequired(
  v: unknown
): v is { payment_required: true; x402Version?: number; accepts?: unknown[]; error?: string } {
  return (
    v != null &&
    typeof v === "object" &&
    (v as { payment_required?: unknown }).payment_required === true
  );
}
