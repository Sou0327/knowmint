import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { logAuditEvent } from "@/lib/audit/log";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reviewSchema = z.object({
  action: z.enum(["resolve", "dismiss", "start_review"]),
  reviewer_note: z.string().max(1000).optional(),
  remove_item: z.boolean().optional(),
});

/**
 * POST /api/v1/admin/reports/[id]
 * 管理者用: 報告をレビュー (resolve / dismiss / start_review)
 */
export const POST = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;

  if (!UUID_RE.test(id)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid report ID");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(API_ERRORS.BAD_REQUEST, parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const { action, reviewer_note, remove_item } = parsed.data;
  const admin = getAdminClient();

  // 報告の存在確認
  const { data: report, error: fetchError } = await admin
    .from("knowledge_item_reports")
    .select("id, knowledge_item_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !report) {
    return apiError(API_ERRORS.NOT_FOUND, "Report not found");
  }

  const newStatus = action === "resolve" ? "resolved" : action === "dismiss" ? "dismissed" : "reviewing";

  // admin_review_report RPC で報告更新とアイテム変更を同一トランザクションで実施
  const { error: rpcError } = await admin.rpc("admin_review_report", {
    p_report_id:    id,
    p_new_status:   newStatus,
    p_reviewer_id:  user.userId,
    p_reviewer_note: reviewer_note ?? null,
    p_remove_item:  action === "resolve" && remove_item === true,
  });

  if (rpcError) {
    console.error("[admin/reports] admin_review_report rpc failed:", rpcError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  logAuditEvent({
    userId: user.userId,
    action: "report.reviewed",
    resourceType: "knowledge_item_report",
    resourceId: id,
    metadata: { action, remove_item: remove_item ?? false, knowledge_item_id: report.knowledge_item_id },
  });

  return apiSuccess({ reviewed: true, status: newStatus });
}, { requiredPermissions: ["admin"] });
