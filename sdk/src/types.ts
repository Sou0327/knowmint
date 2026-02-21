/** SDK クライアント設定 */
export interface KmClientOptions {
  /** Knowledge Market API キー (km_<64 hex>) */
  apiKey: string;
  /** API ベース URL (デフォルト: http://127.0.0.1:3000) */
  baseUrl?: string;
  /** リクエストタイムアウト (ms, デフォルト: 30000) */
  timeoutMs?: number;
}

/** ナレッジコンテンツタイプ */
export type ContentType = "prompt" | "tool_def" | "dataset" | "api" | "general";

/** ナレッジアイテムのメタデータ */
export interface KnowledgeItemMetadata {
  domain?: string;
  experience_type?: string;
  applicable_to?: string[];
  source_type?: string;
}

/** 売り手のプロフィール (search/get レスポンスにジョイン) */
export interface SellerProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  trust_score: number | null;
}

/** ナレッジアイテム */
export interface KnowledgeItem {
  id: string;
  title: string;
  description: string;
  content_type: ContentType;
  price_sol: number | null;
  price_usdc: number | null;
  preview_content: string | null;
  tags: string[];
  status: "draft" | "published" | "archived" | "suspended";
  view_count: number;
  purchase_count: number;
  average_rating: number | null;
  usefulness_score: number | null;
  metadata: KnowledgeItemMetadata | null;
  seller: SellerProfile | null;
  created_at: string;
  updated_at: string;
}

/** 購入済みナレッジのフルコンテンツ */
export interface KnowledgeContent {
  full_content: string | null;
  file_url: string | null;
}

/** ナレッジバージョン履歴エントリ */
export interface KnowledgeVersion {
  id: string;
  version_number: number;
  title: string;
  description: string;
  change_summary: string | null;
  created_at: string;
}

/** 検索パラメータ */
export interface SearchParams {
  /** 全文検索クエリ */
  query?: string;
  /** コンテンツタイプでフィルタ */
  content_type?: ContentType;
  /** ソート順 */
  sort_by?: "newest" | "popular" | "price_low" | "price_high" | "rating" | "trust_score";
  /** 最大取得件数 */
  max_results?: number;
  /** メタデータ: ドメインでフィルタ */
  metadata_domain?: string;
  /** メタデータ: 体験タイプでフィルタ */
  metadata_experience_type?: string;
  /** メタデータ: ソースタイプでフィルタ */
  metadata_source_type?: string;
}

/** ページネーション情報 */
export interface Pagination {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/** 検索結果 */
export interface SearchResult {
  data: KnowledgeItem[];
  pagination: Pagination;
}

/** 出品入力 */
export interface PublishInput {
  title: string;
  description: string;
  content_type: ContentType;
  /** フルコンテンツ (購入者のみ閲覧可) */
  content: string;
  price_sol?: number;
  price_usdc?: number;
  tags?: string[];
}

/** 購入記録入力 */
export interface PurchaseInput {
  /** 購入するナレッジアイテムの ID */
  knowledgeId: string;
  /** オンチェーントランザクションハッシュ */
  txHash: string;
  /** 決済トークン (デフォルト: SOL)。現在 SOL と USDC のみ対応。 */
  token?: "SOL" | "USDC";
  /** 決済チェーン (デフォルト: solana)。現在 solana のみ対応。 */
  chain?: "solana";
}

/** 購入記録の結果 */
export interface PurchaseResult {
  id: string;
  knowledge_item_id: string;
  tx_hash: string;
  amount: number;
  token: string;
  chain: string;
  status: "pending" | "confirmed" | "failed" | "refunded";
  created_at: string;
}
