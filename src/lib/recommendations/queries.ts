import { createClient } from "@/lib/supabase/server";
import type { ContentType, ListingType } from "@/types/database.types";

/** レコメンド結果の型 (KnowledgeCardRow と同等のサブセット) */
export interface RecommendationRow {
  id: string;
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  price_sol: number | null;
  tags: string[];
  average_rating: number | null;
  purchase_count: number;
  seller: { id: string; display_name: string | null; avatar_url: string | null } | null;
  category: { id: string; name: string; slug: string } | null;
}

const RECOMMENDATION_SELECT =
  "id, listing_type, title, description, content_type, price_sol, tags, average_rating, purchase_count, seller:profiles!seller_id(id, display_name, avatar_url), category:categories(id, name, slug)" as const;

import { toSingle } from "@/lib/supabase/utils";

/** Supabase レスポンスを RecommendationRow[] に正規化 */
function normalizeRows(rows: Array<Record<string, unknown>>): RecommendationRow[] {
  return rows.map((row) => ({
    ...row,
    seller: toSingle(row.seller as RecommendationRow["seller"]),
    category: toSingle(row.category as RecommendationRow["category"]),
  })) as RecommendationRow[];
}

/**
 * アイテム詳細ページ用：関連アイテム取得
 * 1. 同カテゴリの人気アイテム
 * 2. 共通タグを持つアイテム
 */
export async function getRecommendations(itemId: string, limit = 6): Promise<RecommendationRow[]> {
  const supabase = await createClient();

  // まず対象アイテムの情報を取得
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("category_id, tags")
    .eq("id", itemId)
    .single();

  if (!item) return [];

  // 同カテゴリの人気アイテム（自身を除外）
  let query = supabase
    .from("knowledge_items")
    .select(RECOMMENDATION_SELECT)
    .eq("status", "published")
    .neq("id", itemId)
    .order("purchase_count", { ascending: false })
    .limit(limit);

  if (item.category_id) {
    query = query.eq("category_id", item.category_id);
  }

  const { data } = await query;

  // カテゴリだけでは足りない場合、タグベースで補完
  if (!data || data.length < limit) {
    const existing = new Set((data ?? []).map((d) => d.id));
    existing.add(itemId);

    const tags = item.tags as string[] | null;
    if (tags && tags.length > 0) {
      const { data: tagBased } = await supabase
        .from("knowledge_items")
        .select(RECOMMENDATION_SELECT)
        .eq("status", "published")
        .overlaps("tags", tags)
        .order("purchase_count", { ascending: false })
        .limit(limit);

      if (tagBased) {
        const combined = [...(data ?? [])];
        for (const tb of tagBased) {
          if (!existing.has(tb.id) && combined.length < limit) {
            combined.push(tb);
            existing.add(tb.id);
          }
        }
        return normalizeRows(combined as Array<Record<string, unknown>>);
      }
    }
  }

  return normalizeRows((data ?? []) as Array<Record<string, unknown>>);
}

/**
 * トップページ用：ログインユーザーへのパーソナルレコメンド
 * 購入履歴のカテゴリ・タグから推薦
 */
export async function getPersonalRecommendations(userId: string, limit = 6): Promise<RecommendationRow[]> {
  const supabase = await createClient();

  // ユーザーの購入履歴からカテゴリとタグを集計
  const { data: purchases } = await supabase
    .from("transactions")
    .select("knowledge_item:knowledge_items(category_id, tags)")
    .eq("buyer_id", userId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!purchases || purchases.length === 0) {
    // 購入履歴がなければ人気アイテムを返す
    const { data } = await supabase
      .from("knowledge_items")
      .select(RECOMMENDATION_SELECT)
      .eq("status", "published")
      .order("purchase_count", { ascending: false })
      .limit(limit);
    return normalizeRows((data ?? []) as Array<Record<string, unknown>>);
  }

  // 購入したアイテムのカテゴリIDを収集
  const categoryIds = new Set<string>();
  const allTags = new Set<string>();

  for (const p of purchases) {
    const itemRef = toSingle(p.knowledge_item);
    if (itemRef && typeof itemRef === "object") {
      if (itemRef.category_id) categoryIds.add(itemRef.category_id);
      if (Array.isArray(itemRef.tags)) {
        (itemRef.tags as string[]).forEach((t) => allTags.add(t));
      }
    }
  }

  // 購入済みアイテムIDを取得（除外用）
  const { data: purchasedItems } = await supabase
    .from("transactions")
    .select("knowledge_item_id")
    .eq("buyer_id", userId)
    .eq("status", "confirmed");

  const purchasedIds = new Set((purchasedItems ?? []).map((p) => p.knowledge_item_id));

  // カテゴリベースのレコメンド
  let results: RecommendationRow[] = [];

  if (categoryIds.size > 0) {
    const { data } = await supabase
      .from("knowledge_items")
      .select(RECOMMENDATION_SELECT)
      .eq("status", "published")
      .in("category_id", Array.from(categoryIds))
      .order("purchase_count", { ascending: false })
      .limit(limit * 2);

    if (data) {
      results = normalizeRows(
        (data as Array<Record<string, unknown>>).filter((d) => !purchasedIds.has((d as { id: string }).id))
      ).slice(0, limit);
    }
  }

  // タグベースで補完
  if (results.length < limit && allTags.size > 0) {
    const existing = new Set(results.map((r) => r.id));
    const { data: tagBased } = await supabase
      .from("knowledge_items")
      .select(RECOMMENDATION_SELECT)
      .eq("status", "published")
      .overlaps("tags", Array.from(allTags))
      .order("purchase_count", { ascending: false })
      .limit(limit);

    if (tagBased) {
      const normalized = normalizeRows(tagBased as Array<Record<string, unknown>>);
      for (const tb of normalized) {
        if (!existing.has(tb.id) && !purchasedIds.has(tb.id) && results.length < limit) {
          results.push(tb);
          existing.add(tb.id);
        }
      }
    }
  }

  return results;
}
