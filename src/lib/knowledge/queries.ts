import { createClient } from "@/lib/supabase/server";
import type { KnowledgeSearchParams } from "@/types/knowledge.types";

export async function getPublishedKnowledge(params: KnowledgeSearchParams = {}) {
  const supabase = await createClient();
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
    return { data: [], total: 0, page, per_page, total_pages: 0 };
  }

  let resultData = data ?? [];

  if (isTrustScoreSort) {
    // seller.trust_score 降順でソート (null は末尾)
    resultData = [...resultData].sort((a, b) => {
      const scoreA = (a as { seller?: { trust_score?: number | null } }).seller?.trust_score ?? -1;
      const scoreB = (b as { seller?: { trust_score?: number | null } }).seller?.trust_score ?? -1;
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
  return data;
}

export async function getKnowledgeById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_items")
    .select(
      `id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content, category_id, tags, status, view_count, purchase_count, average_rating, created_at, updated_at,
       seller:profiles!seller_id(id, display_name, avatar_url, trust_score, bio, user_type, wallet_address),
       category:categories(id, name, slug),
       reviews(id, rating, comment, created_at, reviewer:profiles!reviewer_id(id, display_name, avatar_url))`
    )
    .eq("id", id)
    .single();

  if (error) return null;

  // Increment view count via SECURITY DEFINER RPC (Admin クライアント使用: service_role 権限が必要)
  const { getAdminClient: getAdmin } = await import("@/lib/supabase/admin");
  getAdmin().rpc("increment_view_count", { item_id: id }).then(() => {}, () => {});

  return data;
}

export async function getCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, icon")
    .order("name");
  return data ?? [];
}

export async function getKnowledgeByCategory(slug: string, page = 1, perPage = 12) {
  const supabase = await createClient();

  // Get category
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!category) return { category: null, items: [], total: 0, page, total_pages: 0 };

  const from = (page - 1) * perPage;
  const { data, count } = await supabase
    .from("knowledge_items")
    .select(
      "id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content, category_id, tags, status, view_count, purchase_count, average_rating, created_at, updated_at, seller:profiles!seller_id(id, display_name, avatar_url, trust_score), category:categories(id, name, slug)",
      { count: "exact" }
    )
    .eq("status", "published")
    .eq("category_id", category.id)
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  const total = count ?? 0;
  return {
    category,
    items: data ?? [],
    total,
    page,
    total_pages: Math.ceil(total / perPage),
  };
}
