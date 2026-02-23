import { apiRequest, apiRequestPaginated } from "./internal/api.js";
import type {
  KmClientOptions,
  KnowledgeItem,
  KnowledgeContent,
  KnowledgeVersion,
  SearchParams,
  SearchResult,
  PublishInput,
  PurchaseInput,
  PurchaseResult,
} from "./types.js";

/**
 * KnowMint API クライアント。
 *
 * @example
 * ```typescript
 * const client = new KnowledgeMarketClient({ apiKey: "km_..." });
 * const results = await client.search({ query: "prompt engineering" });
 * ```
 */
export class KnowledgeMarketClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: KmClientOptions) {
    this.apiKey = options.apiKey;
    const raw = (options.baseUrl ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
    // 非 localhost は HTTPS を必須にして API キーの平文送信を防止
    try {
      const parsed = new URL(raw);
      const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1" || parsed.hostname === "[::1]";
      if (!isLocalhost && parsed.protocol !== "https:") {
        throw new Error(`Non-localhost base URL must use HTTPS: ${raw}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("HTTPS")) throw e;
      throw new Error(`Invalid base URL: ${raw}`);
    }
    this.baseUrl = raw;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  /**
   * ナレッジを検索する。
   *
   * @param params - 検索パラメータ
   * @returns ページネーション付き検索結果
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const qs = new URLSearchParams();

    if (params.query) qs.set("query", params.query);
    if (params.content_type) qs.set("content_type", params.content_type);
    if (params.sort_by) qs.set("sort_by", params.sort_by);
    if (params.max_results != null) qs.set("per_page", String(params.max_results));
    if (params.metadata_domain) qs.set("metadata_domain", params.metadata_domain);
    if (params.metadata_experience_type) {
      qs.set("metadata_experience_type", params.metadata_experience_type);
    }
    if (params.metadata_source_type) qs.set("metadata_source_type", params.metadata_source_type);

    const path = `/api/v1/knowledge${qs.toString() ? `?${qs.toString()}` : ""}`;
    return apiRequestPaginated<KnowledgeItem>(this.baseUrl, this.apiKey, path, this.timeoutMs);
  }

  /**
   * ナレッジアイテムの詳細を取得する。
   *
   * @param id - ナレッジアイテム ID
   * @returns ナレッジアイテム (売り手プロフィール付き)
   */
  async getItem(id: string): Promise<KnowledgeItem> {
    const path = `/api/v1/knowledge/${encodeURIComponent(id)}`;
    return apiRequest<KnowledgeItem>(
      this.baseUrl,
      this.apiKey,
      path,
      "GET",
      undefined,
      this.timeoutMs
    );
  }

  /**
   * 購入済みナレッジのフルコンテンツを取得する。
   * 購入済みでない場合は 403 エラーになる。
   *
   * @param id - ナレッジアイテム ID
   * @returns フルコンテンツ
   */
  async getContent(id: string): Promise<KnowledgeContent> {
    const path = `/api/v1/knowledge/${encodeURIComponent(id)}/content`;
    return apiRequest<KnowledgeContent>(
      this.baseUrl,
      this.apiKey,
      path,
      "GET",
      undefined,
      this.timeoutMs
    );
  }

  /**
   * オンチェーン購入のトランザクションを記録する。
   * 実際の SOL/トークン送金はオンチェーンで事前に行う必要がある。
   *
   * @param input - 購入入力 (ナレッジID + txHash)
   * @returns 記録されたトランザクション
   */
  async recordPurchase(input: PurchaseInput): Promise<PurchaseResult> {
    const path = `/api/v1/knowledge/${encodeURIComponent(input.knowledgeId)}/purchase`;
    return apiRequest<PurchaseResult>(
      this.baseUrl,
      this.apiKey,
      path,
      "POST",
      {
        tx_hash: input.txHash,
        token: input.token ?? "SOL",
        chain: input.chain ?? "solana",
      },
      this.timeoutMs
    );
  }

  /**
   * ナレッジのバージョン履歴を取得する。
   *
   * @param id - ナレッジアイテム ID
   * @param options - ページネーションオプション
   * @returns ページネーション付きバージョン履歴 (新しい順)
   */
  async getVersionHistory(
    id: string,
    options?: { page?: number; perPage?: number }
  ): Promise<{ data: KnowledgeVersion[]; pagination: { total: number; page: number; per_page: number; total_pages: number } }> {
    const qs = new URLSearchParams();
    if (options?.page != null) qs.set("page", String(options.page));
    if (options?.perPage != null) qs.set("per_page", String(options.perPage));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const path = `/api/v1/knowledge/${encodeURIComponent(id)}/versions${suffix}`;
    return apiRequestPaginated<KnowledgeVersion>(
      this.baseUrl,
      this.apiKey,
      path,
      this.timeoutMs
    );
  }

  /**
   * ナレッジを下書き作成して即時公開する。
   * draft 作成 → publish の 2 ステップを内部で実行する。
   *
   * @param input - 出品入力
   * @returns 公開されたナレッジアイテム
   */
  async publish(input: PublishInput): Promise<KnowledgeItem> {
    // Step 1: draft 作成
    const created = await apiRequest<{ id: string }>(
      this.baseUrl,
      this.apiKey,
      "/api/v1/knowledge",
      "POST",
      {
        title: input.title,
        description: input.description,
        content_type: input.content_type,
        full_content: input.content,
        preview_content: input.content.slice(0, 280),
        price_sol: input.price_sol ?? null,
        price_usdc: input.price_usdc ?? null,
        tags: input.tags ?? [],
      },
      this.timeoutMs
    );

    // Step 2: publish
    return apiRequest<KnowledgeItem>(
      this.baseUrl,
      this.apiKey,
      `/api/v1/knowledge/${encodeURIComponent(created.id)}/publish`,
      "POST",
      undefined,
      this.timeoutMs
    );
  }
}
