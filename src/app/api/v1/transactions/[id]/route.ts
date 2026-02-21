import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

/**
 * GET /api/v1/transactions/[id]
 * Returns transaction status for buyer or seller.
 */
export const GET = withApiAuth(async (_request, user, _rateLimit, context) => {
  const { id } = await context!.params;
  const admin = getAdminClient();

  const { data: tx, error } = await admin
    .from("transactions")
    .select(
      `
      id, buyer_id, seller_id, knowledge_item_id, amount, token, chain, tx_hash, status,
      created_at, updated_at
      `
    )
    .eq("id", id)
    .single();

  if (error || !tx) {
    return apiError(API_ERRORS.NOT_FOUND, "Transaction not found");
  }

  if (tx.buyer_id !== user.userId && tx.seller_id !== user.userId) {
    return apiError(API_ERRORS.NOT_FOUND, "Transaction not found");
  }

  return apiSuccess(tx);
}, { requiredPermissions: ["read"] });
