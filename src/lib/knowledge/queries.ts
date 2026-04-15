import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeSearchParams, PaginatedResult } from "@/types/knowledge.types";
import type { ContentType, ListingType, KnowledgeStatus, UserType, Database } from "@/types/database.types";
import { z } from "zod";

// ── 戻り値型定義 ──────────────────────────────────

/** カード表示用 (一覧・カテゴリ・検索) */
export interface KnowledgeCardRow {
  id: string;
  seller_id: string;
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  price_sol: number | null;
  price_usdc: number | null;
  preview_content: string | null;
  category_id: string | null;
  tags: string[];
  status: KnowledgeStatus;
  view_count: number;
  purchase_count: number;
  average_rating: number | null;
  created_at: string;
  updated_at: string;
  seller: { id: string; display_name: string | null; avatar_url: string | null; trust_score: number | null } | null;
  category: { id: string; name: string; slug: string } | null;
}

/** 詳細ページ用 */
export interface KnowledgeDetailRow extends Omit<KnowledgeCardRow, "seller"> {
  usefulness_score: number | null;
  seller: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    trust_score: number | null;
    bio: string | null;
    user_type: UserType;
    wallet_address: string | null;
  } | null;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    reviewer: { id: string; display_name: string | null; avatar_url: string | null } | null;
  }>;
}

import { toSingle } from "@/lib/supabase/utils";

// ── L-11: CARD_SELECT 共通定数 ──────────────────────
/** カード表示に必要なフィールドを1箇所で定義 (queries + recommendations で共用) */
export const CARD_SELECT =
  "id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content, category_id, tags, status, view_count, purchase_count, average_rating, created_at, updated_at, seller:profiles!seller_id(id, display_name, avatar_url, trust_score), category:categories(id, name, slug)" as const;

// ── L-3: getKnowledgeById 戻り値検証スキーマ ─────────
const SellerSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  trust_score: z.number().nullable(),
  bio: z.string().nullable(),
  user_type: z.string(),
  wallet_address: z.string().nullable(),
}).nullable();

const ReviewSchema = z.object({
  id: z.string(),
  rating: z.number(),
  comment: z.string().nullable(),
  created_at: z.string(),
  reviewer: z.object({
    id: z.string(),
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  }).nullable(),
});

const KnowledgeDetailSchema = z.object({
  id: z.string(),
  seller_id: z.string(),
  listing_type: z.string(),
  title: z.string(),
  description: z.string(),
  content_type: z.string(),
  price_sol: z.number().nullable(),
  price_usdc: z.number().nullable(),
  preview_content: z.string().nullable(),
  category_id: z.string().nullable(),
  tags: z.array(z.string()),
  status: z.string(),
  view_count: z.number(),
  purchase_count: z.number(),
  average_rating: z.number().nullable(),
  usefulness_score: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  seller: SellerSchema,
  category: z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable(),
  reviews: z.array(ReviewSchema),
});

// ── クエリ関数 ─────────────────────────────────────

export async function getPublishedKnowledge(
  params: KnowledgeSearchParams = {},
  client?: SupabaseClient<Database>
): Promise<PaginatedResult<KnowledgeCardRow>> {
  const supabase = client ?? (await createClient());
  const {
    query,
    category,
    content_type,
    listing_type,
    min_price,
    max_price,
    sort_by = "newest",
    page = 1,
    per_page = 12,
  } = params;

  let q = supabase
    .from("knowledge_items")
    .select(
      "id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content, category_id, tags, status, view_count, purchase_count, average_rating, created_at, updated_at, seller:profiles!seller_id(id, display_name, avatar_url, trust_score), category:categories(id, name, slug)",
      { count: "exact" }
    )
    .eq("status", "published");

  if (query) {
    q = q.textSearch("search_vector", query, { type: "websearch" });
  }

  if (category) {
    q = q.eq("categories.slug", category);
  }

  if (content_type) {
    q = q.eq("content_type", content_type);
  }

  if (listing_type) {
    q = q.eq("listing_type", listing_type);
  }

  if (min_price !== undefined) {
    q = q.gte("price_sol", min_price);
  }

  if (max_price !== undefined) {
    q = q.lte("price_sol", max_price);
  }

  // Sort
  switch (sort_by) {
    case "popular":
      q = q.order("purchase_count", { ascending: false });
      break;
    case "price_low":
      q = q.order("price_sol", { ascending: true, nullsFirst: false });
      break;
    case "price_high":
      q = q.order("price_sol", { ascending: false });
      break;
    case "rating":
      q = q.order("average_rating", { ascending: false, nullsFirst: false });
      break;
    case "trust_score":
      // trust_score は profiles テーブルにあるため DB で直接 ORDER BY 不可
      // 上限件数を取得してアプリ側でソート+ページングする
      q = q.order("created_at", { ascending: false });
      break;
    case "newest":
    default:
      q = q.order("created_at", { ascending: false });
      break;
  }

  const isTrustScoreSort = sort_by === "trust_score";
  // B-24 Performance: accepted — trust_score は profiles JOIN の関係で DB ORDER BY 不可。
  // 200件上限取得+アプリソートは現状の実用的な妥協策。
  // 改善案: DB の seller trust_score を knowledge_items にキャッシュするカラム追加 (schema 変更必要)。
  const TRUST_SCORE_FETCH_LIMIT = 200;

  // trust_score ソート時は DB ページングせず上限件数を取得
  if (isTrustScoreSort) {
    q = q.limit(TRUST_SCORE_FETCH_LIMIT);
  } else {
    const from = (page - 1) * per_page;
    q = q.range(from, from + per_page - 1);
  }

  const { data, count, error } = await q;

  if (error) {
    console.error("[knowledge-queries] DB query failed:", error.message, error.code);
    return { data: [], total: 0, page, per_page, total_pages: 0 };
  }

  // nested join を正規化
  let resultData: KnowledgeCardRow[] = (data ?? []).map((row) => ({
    ...row,
    seller: toSingle(row.seller),
    category: toSingle(row.category),
  })) as KnowledgeCardRow[];

  if (isTrustScoreSort) {
    // seller.trust_score 降順でソート (null は末尾)
    resultData = [...resultData].sort((a, b) => {
      const scoreA = a.seller?.trust_score ?? -1;
      const scoreB = b.seller?.trust_score ?? -1;
      return scoreB - scoreA;
    });
    const from = (page - 1) * per_page;
    resultData = resultData.slice(from, from + per_page);
    const effectiveTotal = Math.min(count ?? 0, TRUST_SCORE_FETCH_LIMIT);
    return {
      data: resultData,
      total: effectiveTotal,
      page,
      per_page,
      total_pages: Math.ceil(effectiveTotal / per_page),
    };
  }

  const total = count ?? 0;
  return {
    data: resultData,
    total,
    page,
    per_page,
    total_pages: Math.ceil(total / per_page),
  };
}

export async function getKnowledgeForMetadata(id: string) {
  const { getAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await getAdminClient()
    .from("knowledge_items")
    .select("id, title, description, tags, content_type, price_sol, category:categories(name, slug), seller:profiles!seller_id(display_name)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  return {
    ...data,
    seller: toSingle(data.seller),
    category: toSingle(data.category),
  };
}

export async function getKnowledgeById(id: string): Promise<KnowledgeDetailRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_items")
    .select(
      `id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content, category_id, tags, status, view_count, purchase_count, average_rating, usefulness_score, created_at, updated_at,
       seller:profiles!seller_id(id, display_name, avatar_url, trust_score, bio, user_type, wallet_address),
       category:categories(id, name, slug),
       reviews(id, rating, comment, created_at, reviewer:profiles!reviewer_id(id, display_name, avatar_url))`
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  // Increment view count via SECURITY DEFINER RPC (Admin クライアント使用: service_role 権限が必要)
  const { getAdminClient: getAdmin } = await import("@/lib/supabase/admin");
  void (async () => {
    const { error: e } = await getAdmin().rpc("increment_view_count", { item_id: id });
    if (e) console.error("[knowledge] increment_view_count failed:", e.message, e.code);
  })().catch((e: unknown) => console.error("[knowledge] increment_view_count failed:", e));

  // nested join を正規化
  const normalized = {
    ...data,
    seller: toSingle(data.seller),
    category: toSingle(data.category),
    reviews: (data.reviews ?? []).map((r) => ({
      ...r,
      reviewer: toSingle(r.reviewer),
    })),
  };

  // L-3: Zod parse で実行時型安全を確保 (as キャスト除去)
  const parsed = KnowledgeDetailSchema.safeParse(normalized);
  if (!parsed.success) {
    console.error("[knowledge-queries] getKnowledgeById parse failed:", parsed.error.issues);
    return null;
  }
  return parsed.data as KnowledgeDetailRow;
}

export async function getCategories(client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, icon")
    .order("created_at")
    .order("id");
  return data ?? [];
}

export async function getKnowledgeByCategory(slug: string, page = 1, perPage = 12): Promise<{
  category: { id: string; name: string; slug: string } | null;
  items: KnowledgeCardRow[];
  total: number;
  page: number;
  total_pages: number;
}> {
  const supabase = await createClient();

  // L-21: 2ラウンドトリップ → 1クエリに統合
  // categories テーブルを JOIN し slug でフィルタリング (category_id 先引き不要)
  const from = (page - 1) * perPage;
  const { data, count } = await supabase
    .from("knowledge_items")
    .select(
      "id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content, category_id, tags, status, view_count, purchase_count, average_rating, created_at, updated_at, seller:profiles!seller_id(id, display_name, avatar_url, trust_score), category:categories!inner(id, name, slug)",
      { count: "exact" }
    )
    .eq("status", "published")
    .eq("categories.slug", slug)
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  // カテゴリ情報を結果から取得
  const firstRow = data?.[0];
  const category = firstRow ? toSingle((firstRow as { category: unknown }).category) as { id: string; name: string; slug: string } | null : null;

  // slug に一致するアイテムが 0 件の場合は categories テーブルから取得
  const resolvedCategory = category ?? await (async () => {
    const { data: cat } = await supabase
      .from("categories")
      .select("id, name, slug")
      .eq("slug", slug)
      .maybeSingle();
    return cat;
  })();

  if (!resolvedCategory) return { category: null, items: [], total: 0, page, total_pages: 0 };

  const items: KnowledgeCardRow[] = (data ?? []).map((row) => ({
    ...row,
    seller: toSingle(row.seller),
    category: toSingle(row.category),
  })) as KnowledgeCardRow[];

  const total = count ?? 0;
  return {
    category: resolvedCategory,
    items,
    total,
    page,
    total_pages: Math.ceil(total / perPage),
  };
}
