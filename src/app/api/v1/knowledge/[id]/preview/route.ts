import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

/**
 * GET /api/v1/knowledge/[id]/preview
 * Returns preview data for a published knowledge item.
 */
export const GET = withApiAuth(async (_request, _user, _rateLimit, context) => {
  const { id } = await context!.params;
  const admin = getAdminClient();

  const { data: item, error } = await admin
    .from("knowledge_items")
    .select(
      "id, listing_type, title, description, content_type, price_sol, price_usdc, preview_content"
    )
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (error || !item) {
    return apiError(API_ERRORS.NOT_FOUND);
  }

  return apiSuccess(item);
}, { requiredPermissions: ["read"] });
