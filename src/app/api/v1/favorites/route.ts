import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/favorites
 * Returns the user's favorite knowledge items
 */
export const GET = withApiAuth(async (request, user) => {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("favorites")
    .select(
      `
      id, knowledge_item_id, created_at,
      knowledge_item:knowledge_items(
        id, listing_type, title, description, content_type, price_sol, price_usdc,
        tags, average_rating, purchase_count,
        seller:profiles!seller_id(id, display_name, avatar_url),
        category:categories(id, name, slug)
      )
      `
    )
    .eq("user_id", user.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch favorites:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess(data ?? []);
}, { requiredPermissions: ["read"] });

/**
 * POST /api/v1/favorites
 * Adds a knowledge item to favorites
 * Body: { knowledge_item_id: string }
 */
export const POST = withApiAuth(async (request, user) => {
  let body: { knowledge_item_id?: string };

  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  if (!body.knowledge_item_id || typeof body.knowledge_item_id !== "string" || !UUID_RE.test(body.knowledge_item_id)) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Missing or invalid field: knowledge_item_id must be a valid UUID"
    );
  }

  const supabase = getAdminClient();

  // Check if already favorited
  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.userId)
    .eq("knowledge_item_id", body.knowledge_item_id)
    .maybeSingle();

  if (existing) {
    return apiError(API_ERRORS.CONFLICT, "Already favorited");
  }

  // Check if knowledge item exists
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("id")
    .eq("id", body.knowledge_item_id)
    .single();

  if (!item) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  const { data, error } = await supabase
    .from("favorites")
    .insert({
      user_id: user.userId,
      knowledge_item_id: body.knowledge_item_id,
    })
    .select("id, knowledge_item_id, created_at")
    .single();

  if (error || !data) {
    console.error("Failed to add favorite:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess(data, 201);
}, { requiredPermissions: ["write"] });

/**
 * DELETE /api/v1/favorites
 * Removes a knowledge item from favorites
 * Body: { knowledge_item_id: string }
 */
export const DELETE = withApiAuth(async (request, user) => {
  let body: { knowledge_item_id?: string };

  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  if (!body.knowledge_item_id || typeof body.knowledge_item_id !== "string" || !UUID_RE.test(body.knowledge_item_id)) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Missing or invalid field: knowledge_item_id must be a valid UUID"
    );
  }

  const supabase = getAdminClient();

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.userId)
    .eq("knowledge_item_id", body.knowledge_item_id);

  if (error) {
    console.error("Failed to delete favorite:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess({ removed: true });
}, { requiredPermissions: ["write"] });
