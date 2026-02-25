/** KnowMint API 接続設定 */
export interface KnowMintConfig {
  /** API key in `km_<64 hex>` format */
  apiKey: string;
  /** Base URL (defaults to https://knowmint.shop) */
  baseUrl?: string;
}

/** ページネーション付きレスポンス */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

/** x402 HTTP 402 Payment Required レスポンス */
export interface PaymentRequiredResponse {
  payment_required: true;
  x402Version?: number;
  accepts?: X402Accept[];
  error?: string;
}

/** x402 accepts エントリ */
export interface X402Accept {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
}
