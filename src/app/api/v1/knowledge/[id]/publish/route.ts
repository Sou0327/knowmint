import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

/**
 * POST /api/v1/knowledge/[id]/publish
 * Publish a draft knowledge item owned by the authenticated user.
 */
export const POST = withApiAuth(async (_request, user, _rateLimit, context) => {
  const { id } = await context!.params;
  const admin = getAdminClient();

  const { data: item, error: fetchError } = await admin
    .from("knowledge_items")
    .select("id, seller_id, listing_type, title, description, status, price_sol, price_usdc, content_type")
    .eq("id", id)
    .single();

  if (fetchError || !item) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  if (item.seller_id !== user.userId) {
    return apiError(API_ERRORS.FORBIDDEN, "You can only publish your own item");
  }

  if (item.status === "published") {
    return apiSuccess({ id: item.id, status: item.status });
  }

  if (item.status !== "draft") {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Only draft items can be published"
    );
  }

  if (!item.title?.trim() || !item.description?.trim()) {
    return apiError(API_ERRORS.BAD_REQUEST, "Title and description are required");
  }

  const hasSolPrice = item.price_sol !== null && item.price_sol !== undefined && item.price_sol > 0;
  const hasUsdcPrice = item.price_usdc !== null && item.price_usdc !== undefined && item.price_usdc > 0;
  if (!hasSolPrice && !hasUsdcPrice) {
    return apiError(API_ERRORS.BAD_REQUEST, "At least one valid price is required");
  }

  if (item.content_type === "dataset") {
    const { data: content, error: contentError } = await admin
      .from("knowledge_item_contents")
      .select("file_url")
      .eq("knowledge_item_id", id)
      .single();

    if (contentError || !content?.file_url) {
      return apiError(
        API_ERRORS.BAD_REQUEST,
        "Dataset items require an uploaded file before publishing"
      );
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("knowledge_items")
    .update({ status: "published" })
    .eq("id", id)
    .eq("seller_id", user.userId)
    .select(
      `
      id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc,
      preview_content, category_id, tags, status, view_count, purchase_count,
      average_rating, created_at, updated_at
      `
    )
    .single();

  if (updateError || !updated) {
    console.error("Failed to publish knowledge item:", updateError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess(updated);
}, { requiredPermissions: ["write"] });
