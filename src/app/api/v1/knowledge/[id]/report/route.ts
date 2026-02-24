import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_REASONS = ["spam", "illegal", "misleading", "inappropriate", "copyright", "other"] as const;

const reportSchema = z.object({
  reason: z.enum(VALID_REASONS),
  description: z.string().max(1000).optional(),
});

/**
 * POST /api/v1/knowledge/[id]/report
 * ナレッジアイテムを報告する
 */
export const POST = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;

  if (!UUID_RE.test(id)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid knowledge item ID");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(API_ERRORS.BAD_REQUEST, parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const { reason, description } = parsed.data;
  const admin = getAdminClient();

  // アイテムの存在確認 + 自己報告チェック
  const { data: item, error: itemError } = await admin
    .from("knowledge_items")
    .select("id, seller_id, status")
    .eq("id", id)
    .single();

  if (itemError || !item) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  if (item.status !== "published") {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  if (item.seller_id === user.userId) {
    return apiError(API_ERRORS.BAD_REQUEST, "Cannot report your own item");
  }

  // 報告挿入
  const { error: insertError } = await admin
    .from("knowledge_item_reports")
    .insert({
      knowledge_item_id: id,
      reporter_id: user.userId,
      reason,
      description: description ?? null,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return apiError(API_ERRORS.CONFLICT, "You have already reported this item");
    }
    console.error("[report] insert failed:", insertError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  // 自動フラグ (fire-and-forget)
  admin
    .rpc("maybe_flag_for_review", { p_item_id: id })
    .then(() => {}, (err: unknown) => console.error("[report] maybe_flag_for_review failed:", err));

  logAuditEvent({
    userId: user.userId,
    action: "report.created",
    resourceType: "knowledge_item",
    resourceId: id,
    metadata: { reason },
  });

  return apiSuccess({ reported: true }, 201);
}, { requiredPermissions: ["read"] });
