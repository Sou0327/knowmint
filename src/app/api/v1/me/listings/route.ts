import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiError, apiPaginated, API_ERRORS } from "@/lib/api/response";

/**
 * GET /api/v1/me/listings
 * Returns listings for the authenticated API user.
 */
export const GET = withApiAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const rawPerPage = parseInt(searchParams.get("per_page") ?? "20", 10);
  const page = Math.min(1000, Math.max(1, Number.isFinite(rawPage) ? rawPage : 1));
  const perPage = Math.min(100, Math.max(1, Number.isFinite(rawPerPage) ? rawPerPage : 20));

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const admin = getAdminClient();

  const { data, count, error } = await admin
    .from("knowledge_items")
    .select(
      `
      id, listing_type, title, content_type, status, price_sol, price_usdc,
      purchase_count, average_rating, created_at, updated_at
      `,
      { count: "estimated" }
    )
    .eq("seller_id", user.userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[listings] fetch failed:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiPaginated(data ?? [], count ?? 0, page, perPage);
}, { requiredPermissions: ["read"] });
