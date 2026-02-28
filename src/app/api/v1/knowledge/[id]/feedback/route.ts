import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { fireWebhookEvent } from "@/lib/webhooks/events";
import { logAuditEvent } from "@/lib/audit/log";

/**
 * POST /api/v1/knowledge/[id]/feedback
 * 購入済みユーザーが有用性フィードバックを送信する。
 * 1トランザクション = 1フィードバック（UNIQUE制約）
 * トリガーにより knowledge_items.usefulness_score が自動更新される。
 */
export const POST = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;

  let body: { useful?: unknown; usage_context?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  if (typeof body.useful !== "boolean") {
    return apiError(API_ERRORS.BAD_REQUEST, "Missing or invalid field: useful (boolean required)");
  }

  if (
    body.usage_context !== undefined &&
    body.usage_context !== null &&
    (typeof body.usage_context !== "string" || body.usage_context.length > 500)
  ) {
    return apiError(API_ERRORS.BAD_REQUEST, "usage_context must be a string of 500 characters or fewer");
  }

  const supabase = getAdminClient();

  // 購入確認: buyer_id = user.id かつ knowledge_item_id = id の confirmed トランザクション
  // seller_id != user.userId で出品者が自分のアイテムにフィードバックできないよう排除
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.userId)
    .eq("knowledge_item_id", id)
    .eq("status", "confirmed")
    .neq("seller_id", user.userId)
    .maybeSingle();

  if (txError || !tx) {
    return apiError(API_ERRORS.FORBIDDEN, "No confirmed purchase found for this item");
  }

  // 既存フィードバック確認（UNIQUE制約で弾かれる前に適切なエラーを返す）
  const { data: existing } = await supabase
    .from("knowledge_feedbacks")
    .select("id")
    .eq("transaction_id", tx.id)
    .maybeSingle();

  if (existing) {
    return apiError(API_ERRORS.CONFLICT, "Feedback already submitted for this transaction");
  }

  // INSERT（トリガーが usefulness_score を自動更新）
  const { error: insertError } = await supabase
    .from("knowledge_feedbacks")
    .insert({
      knowledge_item_id: id,
      buyer_id: user.userId,
      transaction_id: tx.id,
      useful: body.useful,
      usage_context: typeof body.usage_context === "string" ? body.usage_context : null,
    });

  if (insertError) {
    // UNIQUE 違反（レース条件）→ 409 Conflict として返す
    if (insertError.code === "23505") {
      return apiError(API_ERRORS.CONFLICT, "Feedback already submitted for this transaction");
    }
    console.error("[feedback] insert failed:", { userId: user.userId, itemId: id, error: insertError });
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  logAuditEvent({
    userId: user.userId,
    action: "feedback.created",
    resourceType: "knowledge_item",
    resourceId: id,
    metadata: { useful: body.useful },
  });

  // Fire webhook event (fire-and-forget)
  fireWebhookEvent(user.userId, "review.created", {
    knowledge_id: id,
    useful: body.useful,
  }).catch((err: unknown) => console.error("[feedback] webhook dispatch failed:", { userId: user.userId, itemId: id, error: err }));

  return apiSuccess({ submitted: true, transaction_id: tx.id }, 201);
}, { requiredPermissions: ["write"] });
