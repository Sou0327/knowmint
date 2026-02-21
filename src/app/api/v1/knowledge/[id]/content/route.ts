import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { createDatasetSignedDownloadUrl } from "@/lib/storage/datasets";

/**
 * GET /api/v1/knowledge/[id]/content
 * Returns full content for purchased items or seller's own items.
 * Supports ?format=raw for plain text output.
 */
export const GET = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;
  const admin = getAdminClient();

  // Check if item exists
  const { data: item } = await admin
    .from("knowledge_items")
    .select("seller_id")
    .eq("id", id)
    .single();

  if (!item) {
    return apiError(API_ERRORS.NOT_FOUND);
  }

  const isSeller = item.seller_id === user.userId;

  // Check if user has purchased
  const { data: transaction } = await admin
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.userId)
    .eq("knowledge_item_id", id)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();

  if (!isSeller && !transaction) {
    return apiError(
      API_ERRORS.FORBIDDEN,
      "You must purchase this item to access its content"
    );
  }

  // Fetch full content
  const { data: content, error } = await admin
    .from("knowledge_item_contents")
    .select("full_content, file_url")
    .eq("knowledge_item_id", id)
    .single();

  if (error || !content) {
    return apiError(API_ERRORS.NOT_FOUND, "Content not found");
  }

  // Raw format support
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format === "raw" && content.full_content) {
    return new Response(content.full_content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const signedFileUrl = content.file_url
    ? await createDatasetSignedDownloadUrl(admin, content.file_url, 900)
    : null;

  return apiSuccess({
    full_content: content.full_content,
    file_url: signedFileUrl || content.file_url,
  });
}, { requiredPermissions: ["read"] });
