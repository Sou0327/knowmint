import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiError, apiPaginated, API_ERRORS } from "@/lib/api/response";

/**
 * GET /api/v1/me/purchases
 * Returns purchases for the authenticated API user.
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
    .from("transactions")
    .select(
      `
      id, knowledge_item_id, amount, token, chain, status, tx_hash, created_at, updated_at,
      knowledge_item:knowledge_items(id, listing_type, title, content_type, price_sol, price_usdc, status)
      `,
      { count: "estimated" }
    )
    .eq("buyer_id", user.userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[purchases] fetch failed:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiPaginated(data ?? [], count ?? 0, page, perPage);
}, { requiredPermissions: ["read"] });
