import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiPaginated, apiError, API_ERRORS } from "@/lib/api/response";

const VALID_STATUSES = ["pending", "reviewing", "resolved", "dismissed"] as const;
type ReportStatus = typeof VALID_STATUSES[number];

/**
 * GET /api/v1/admin/reports
 * 管理者用: 報告一覧取得
 * Query: status=pending&page=1&per_page=20
 */
export const GET = withApiAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status") ?? "pending";
  const page = Math.min(1000, Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "20", 10) || 20));

  if (!(VALID_STATUSES as readonly string[]).includes(statusRaw)) {
    return apiError(API_ERRORS.BAD_REQUEST, `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const status = statusRaw as ReportStatus;
  const admin = getAdminClient();

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, count, error } = await admin
    .from("knowledge_item_reports")
    .select(
      `
      id, knowledge_item_id, reporter_id, reason, description,
      status, reviewer_id, reviewer_note, reviewed_at, created_at,
      knowledge_item:knowledge_items(id, title, seller_id, status)
      `,
      { count: "exact" }
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[admin/reports] fetch failed:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiPaginated(data ?? [], count ?? 0, page, perPage);
}, { requiredPermissions: ["admin"] });
