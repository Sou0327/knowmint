import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

const MAX_BATCH_SIZE = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/knowledge/batch
 * Fetch multiple knowledge items by IDs in a single request.
 * Body: { ids: string[] }
 */
export const POST = withApiAuth(async (request) => {
  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Field 'ids' must be a non-empty array of UUIDs"
    );
  }

  if (ids.length > MAX_BATCH_SIZE) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      `Maximum ${MAX_BATCH_SIZE} IDs per batch request`
    );
  }

  if (ids.some((id) => typeof id !== "string" || !UUID_RE.test(id))) {
    return apiError(API_ERRORS.BAD_REQUEST, "All IDs must be valid UUIDs");
  }

  const admin = getAdminClient();

  const { data, error } = await admin
    .from("knowledge_items")
    .select(
      `id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc,
       preview_content, category_id, tags, status, view_count, purchase_count,
       average_rating, created_at, updated_at,
       seller:profiles!seller_id(id, display_name, avatar_url),
       category:categories(id, name, slug)`
    )
    .in("id", ids)
    .eq("status", "published");

  if (error) {
    console.error("Failed to fetch batch:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess(data ?? []);
}, { requiredPermissions: ["read"] });
