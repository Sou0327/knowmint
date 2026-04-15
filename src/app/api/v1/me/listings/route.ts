import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiError, apiPaginated, API_ERRORS } from "@/lib/api/response";
import { parsePagination } from "@/lib/api/validation";

/**
 * GET /api/v1/me/listings
 * Returns listings for the authenticated API user.
 */
export const GET = withApiAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const { page, perPage } = parsePagination(searchParams);

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
