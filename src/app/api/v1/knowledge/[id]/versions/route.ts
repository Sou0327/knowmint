import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiError, apiPaginated, API_ERRORS } from "@/lib/api/response";

/**
 * GET /api/v1/knowledge/[id]/versions
 * Returns version history for a knowledge item.
 * Accessible by the seller or buyers with a confirmed transaction.
 * full_content is excluded from responses.
 */
export const GET = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;
  const supabase = getAdminClient();

  // アイテム存在確認
  const { data: item, error: itemError } = await supabase
    .from("knowledge_items")
    .select("id, seller_id")
    .eq("id", id)
    .single();

  if (itemError && itemError.code !== "PGRST116") {
    return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to fetch knowledge item");
  }

  if (!item) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  // アクセス権チェック: 売り手または購入者のみ
  const isSeller = item.seller_id === user.userId;

  if (!isSeller) {
    const { data: purchase, error: purchaseError } = await supabase
      .from("transactions")
      .select("id")
      .eq("knowledge_item_id", id)
      .eq("buyer_id", user.userId)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();

    if (purchaseError) {
      return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to check purchase status");
    }

    if (!purchase) {
      return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
    }
  }

  // ページネーションパラメータ
  const url = new URL(request.url);
  const page = Math.min(1000, Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1));
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("per_page") ?? "20", 10) || 20)
  );
  const offset = (page - 1) * perPage;

  // 総件数
  const { count, error: countError } = await supabase
    .from("knowledge_item_versions")
    .select("id", { count: "exact", head: true })
    .eq("knowledge_item_id", id);

  if (countError) {
    return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to count version history");
  }

  const total = count ?? 0;

  // バージョン一覧取得（full_content を除外）
  const { data: versions, error: fetchError } = await supabase
    .from("knowledge_item_versions")
    .select(
      "id, knowledge_item_id, version_number, title, description, preview_content, price_sol, price_usdc, tags, metadata, changed_by, change_summary, created_at"
    )
    .eq("knowledge_item_id", id)
    .order("version_number", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (fetchError) {
    return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to fetch version history");
  }

  return apiPaginated(versions ?? [], total, page, perPage);
}, { requiredPermissions: ["read"] });
