import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { createVersionSnapshot } from "@/lib/knowledge/versions";
import { sanitizeMetadata } from "@/lib/knowledge/metadata";

/**
 * GET /api/v1/knowledge/[id]
 * Returns published knowledge item details (or draft if seller).
 * Increments view_count via RPC.
 */
export const GET = withApiAuth(async (_request, user, _rateLimit, context) => {
  const { id } = await context!.params;
  const supabase = getAdminClient();

  const { data: knowledgeItem, error: fetchError } = await supabase
    .from("knowledge_items")
    .select(
      `
      id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc,
      preview_content, category_id, tags, status, view_count, purchase_count,
      average_rating, metadata, usefulness_score, created_at, updated_at,
      seller:profiles!seller_id(id, display_name, avatar_url, user_type, trust_score),
      category:categories(id, name, slug)
      `
    )
    .eq("id", id)
    .single();

  if (fetchError || !knowledgeItem) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  if (
    knowledgeItem.status !== "published" &&
    knowledgeItem.seller_id !== user.userId
  ) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  // Fetch reviews with limit (C3)
  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `
      id, rating, comment, created_at,
      reviewer:profiles!reviewer_id(id, display_name, avatar_url)
      `
    )
    .eq("knowledge_item_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Increment view_count (fire-and-forget with .catch) (D1)
  supabase
    .rpc("increment_view_count", { item_id: id })
    .then(() => {}, () => {});

  return apiSuccess({
    ...knowledgeItem,
    reviews: reviews ?? [],
  });
}, { requiredPermissions: ["read"] });

interface PatchBody {
  title?: string;
  description?: string;
  preview_content?: string;
  price_sol?: number | null;
  price_usdc?: number | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  full_content?: string;
  change_summary?: string;
}

/**
 * PATCH /api/v1/knowledge/[id]
 * Updates a knowledge item. Saves a version snapshot before applying changes.
 * Only the seller can update their own item.
 */
export const PATCH = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;
  const supabase = getAdminClient();

  // 既存アイテム確認 + 所有者チェック
  const { data: existing, error: existError } = await supabase
    .from("knowledge_items")
    .select("id, seller_id, status")
    .eq("id", id)
    .single();

  if (existError && existError.code !== "PGRST116") {
    return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to fetch knowledge item");
  }

  if (!existing) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  if (existing.seller_id !== user.userId) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  let body: PatchBody;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return apiError(API_ERRORS.BAD_REQUEST, "Request body must be a JSON object");
    }
    body = parsed as PatchBody;
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  // 変更フィールドが存在しない場合はスナップショット不要
  const hasChanges = body.title !== undefined || body.description !== undefined ||
    body.preview_content !== undefined || body.price_sol !== undefined ||
    body.price_usdc !== undefined || body.tags !== undefined ||
    body.metadata !== undefined || body.full_content !== undefined;

  if (!hasChanges) {
    return apiError(API_ERRORS.BAD_REQUEST, "No fields to update");
  }

  // 入力バリデーション: 型チェック + 長さ制限
  if (body.title !== undefined && (typeof body.title !== "string" || body.title.length > 500)) {
    return apiError(API_ERRORS.BAD_REQUEST, "title must be a string of 500 characters or less");
  }
  if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 10000)) {
    return apiError(API_ERRORS.BAD_REQUEST, "description must be a string of 10000 characters or less");
  }
  if (body.preview_content !== undefined && (typeof body.preview_content !== "string" || body.preview_content.length > 1000)) {
    return apiError(API_ERRORS.BAD_REQUEST, "preview_content must be a string of 1000 characters or less");
  }
  if (body.full_content !== undefined && typeof body.full_content !== "string") {
    return apiError(API_ERRORS.BAD_REQUEST, "full_content must be a string");
  }
  if (body.price_sol !== undefined && body.price_sol !== null && (typeof body.price_sol !== "number" || !Number.isFinite(body.price_sol) || body.price_sol < 0)) {
    return apiError(API_ERRORS.BAD_REQUEST, "price_sol must be a non-negative number");
  }
  if (body.price_usdc !== undefined && body.price_usdc !== null && (typeof body.price_usdc !== "number" || !Number.isFinite(body.price_usdc) || body.price_usdc < 0)) {
    return apiError(API_ERRORS.BAD_REQUEST, "price_usdc must be a non-negative number");
  }
  if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.some((t: unknown) => typeof t !== "string"))) {
    return apiError(API_ERRORS.BAD_REQUEST, "tags must be an array of strings");
  }
  if (body.change_summary !== undefined && body.change_summary !== null && (typeof body.change_summary !== "string" || body.change_summary.length > 500)) {
    return apiError(API_ERRORS.BAD_REQUEST, "change_summary must be a string of 500 characters or less");
  }

  // 更新前にバージョンスナップショットを保存
  try {
    await createVersionSnapshot({
      knowledgeItemId: id,
      changedBy: user.userId,
      changeSummary: body.change_summary,
    });
  } catch (snapshotError) {
    console.error("Version snapshot failed:", snapshotError);
    return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to save version snapshot");
  }

  // アイテム更新フィールドの組み立て（undefined は除外）
  const itemUpdate: Record<string, unknown> = {};
  if (body.title !== undefined) itemUpdate.title = body.title;
  if (body.description !== undefined) itemUpdate.description = body.description;
  if (body.preview_content !== undefined) itemUpdate.preview_content = body.preview_content;
  if (body.price_sol !== undefined) itemUpdate.price_sol = body.price_sol;
  if (body.price_usdc !== undefined) itemUpdate.price_usdc = body.price_usdc;
  if (body.tags !== undefined) itemUpdate.tags = body.tags;
  if (body.metadata !== undefined) itemUpdate.metadata = sanitizeMetadata(body.metadata);

  let updated: Record<string, unknown> | null = null;

  if (Object.keys(itemUpdate).length > 0) {
    const { data, error: updateError } = await supabase
      .from("knowledge_items")
      .update(itemUpdate)
      .eq("id", id)
      .select(
        "id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content, category_id, tags, status, view_count, purchase_count, average_rating, metadata, usefulness_score, created_at, updated_at"
      )
      .single();

    if (updateError || !data) {
      return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to update knowledge item");
    }
    updated = data;
  } else {
    // フィールド更新なし — 現状を返す
    const { data } = await supabase
      .from("knowledge_items")
      .select(
        "id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content, category_id, tags, status, view_count, purchase_count, average_rating, metadata, usefulness_score, created_at, updated_at"
      )
      .eq("id", id)
      .single();
    updated = data;
  }

  // full_content の更新（knowledge_item_contents テーブル）
  if (body.full_content !== undefined) {
    const { error: contentError } = await supabase
      .from("knowledge_item_contents")
      .upsert(
        {
          knowledge_item_id: id,
          full_content: body.full_content,
        },
        { onConflict: "knowledge_item_id" }
      );

    if (contentError) {
      console.error("Failed to update content:", contentError);
      return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to update content");
    }
  }

  return apiSuccess(updated);
}, { requiredPermissions: ["write"] });
