import { createClient } from "@/lib/supabase/server";

/**
 * アイテム詳細ページ用：関連アイテム取得
 * 1. 同カテゴリの人気アイテム
 * 2. 共通タグを持つアイテム
 */
export async function getRecommendations(itemId: string, limit = 6) {
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
    .select("id, listing_type, title, description, content_type, price_sol, price_usdc, tags, average_rating, purchase_count, seller:profiles!seller_id(id, display_name, avatar_url), category:categories(id, name, slug)")
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
        .select("id, listing_type, title, description, content_type, price_sol, price_usdc, tags, average_rating, purchase_count, seller:profiles!seller_id(id, display_name, avatar_url), category:categories(id, name, slug)")
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
        return combined;
      }
    }
  }

  return data ?? [];
}

/**
 * トップページ用：ログインユーザーへのパーソナルレコメンド
 * 購入履歴のカテゴリ・タグから推薦
 */
export async function getPersonalRecommendations(userId: string, limit = 6) {
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
      .select("id, listing_type, title, description, content_type, price_sol, price_usdc, tags, average_rating, purchase_count, seller:profiles!seller_id(id, display_name, avatar_url), category:categories(id, name, slug)")
      .eq("status", "published")
      .order("purchase_count", { ascending: false })
      .limit(limit);
    return data ?? [];
  }

  // 購入したアイテムのカテゴリIDを収集
  const categoryIds = new Set<string>();
  const allTags = new Set<string>();

  interface KnowledgeItemRef {
    category_id?: string | null;
    tags?: string[];
  }
  function isKnowledgeItemRef(val: unknown): val is KnowledgeItemRef {
    if (typeof val !== "object" || val === null) return false;
    const v = val as Record<string, unknown>;
    // category_id は null 許容 (カテゴリ未設定は null)
    if ("category_id" in v && v.category_id !== undefined && v.category_id !== null && typeof v.category_id !== "string") return false;
    // tags の各要素が string であることを検証
    if ("tags" in v && v.tags !== undefined) {
      if (!Array.isArray(v.tags) || (v.tags as unknown[]).some((t) => typeof t !== "string")) return false;
    }
    return true;
  }

  for (const p of purchases) {
    const itemRef = p.knowledge_item as unknown;
    if (isKnowledgeItemRef(itemRef)) {
      if (itemRef.category_id) categoryIds.add(itemRef.category_id);
      if (Array.isArray(itemRef.tags)) {
        itemRef.tags.forEach((t) => allTags.add(t));
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
  let results: Record<string, unknown>[] = [];

  if (categoryIds.size > 0) {
    const { data } = await supabase
      .from("knowledge_items")
      .select("id, listing_type, title, description, content_type, price_sol, price_usdc, tags, average_rating, purchase_count, seller:profiles!seller_id(id, display_name, avatar_url), category:categories(id, name, slug)")
      .eq("status", "published")
      .in("category_id", Array.from(categoryIds))
      .order("purchase_count", { ascending: false })
      .limit(limit * 2);

    if (data) {
      results = data.filter((d) => !purchasedIds.has(d.id)).slice(0, limit);
    }
  }

  // タグベースで補完
  if (results.length < limit && allTags.size > 0) {
    const existing = new Set(results.map((r) => r.id as string));
    const { data: tagBased } = await supabase
      .from("knowledge_items")
      .select("id, listing_type, title, description, content_type, price_sol, price_usdc, tags, average_rating, purchase_count, seller:profiles!seller_id(id, display_name, avatar_url), category:categories(id, name, slug)")
      .eq("status", "published")
      .overlaps("tags", Array.from(allTags))
      .order("purchase_count", { ascending: false })
      .limit(limit);

    if (tagBased) {
      for (const tb of tagBased) {
        if (!existing.has(tb.id) && !purchasedIds.has(tb.id) && results.length < limit) {
          results.push(tb);
          existing.add(tb.id);
        }
      }
    }
  }

  return results;
}
