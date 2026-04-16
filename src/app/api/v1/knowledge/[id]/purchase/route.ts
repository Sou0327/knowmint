import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { notifyPurchase } from "@/lib/notifications/create";
import {
  recordPurchaseCore,
  type PurchaseCoreFailure,
} from "@/lib/api/payments/purchase-core";
import type { Chain, Token } from "@/types/database.types";

// NOTE: fireWebhookEvent and logAuditEvent removed — their transitive dependency
// on `undici` (via webhooks/dispatch.ts) breaks opennextjs-cloudflare Workers bundling.
// TODO: Re-enable once webhook dispatch migrates from undici to native fetch.

interface PurchaseRequestBody {
  tx_hash?: unknown;
  token?: unknown;
  chain?: unknown;
}

/** Stable reason key -> English API error message. */
const REASON_MESSAGE: Record<string, string> = {
  tx_hash_required: "Missing or invalid tx_hash",
  chain_not_supported: "Only Solana purchase verification is supported in this phase",
  token_not_supported: "Unsupported token for Solana chain",
  invalid_tx_hash_format: "Invalid Solana transaction hash format",
  item_not_found: "Knowledge item not found",
  item_not_published: "This item is not available for purchase",
  request_listing_not_purchasable: "Request listings cannot be purchased",
  self_purchase_forbidden: "You cannot purchase your own item",
  price_not_set_for_token: "This item has no price set for the selected token",
  wallet_not_configured:
    "Buyer and seller wallet addresses must be configured before purchase verification",
  invalid_wallet_format: "Invalid wallet address format",
  tx_hash_already_used: "Transaction hash is already used",
  verification_failed: "Transaction verification failed",
  confirm_failed: "Transaction confirmation failed",
  confirm_retry_failed: "Transaction confirmation retry failed",
};

function mapCoreFailure(failure: PurchaseCoreFailure) {
  const errorKind =
    failure.code === "not_found"
      ? API_ERRORS.NOT_FOUND
      : failure.code === "conflict"
        ? API_ERRORS.CONFLICT
        : failure.code === "internal"
          ? API_ERRORS.INTERNAL_ERROR
          : API_ERRORS.BAD_REQUEST;
  const message = REASON_MESSAGE[failure.reason];
  return message ? apiError(errorKind, message) : apiError(errorKind);
}

/**
 * POST /api/v1/knowledge/[id]/purchase
 *
 * 購入記録のピュリフローは `@/lib/api/payments/purchase-core` で一元化
 * されている。本 route は以下の責務だけを持つ薄いラッパー:
 *   - 認証・認可 (withApiAuth + write permission)
 *   - JSON パースと body の型チェック
 *   - core 失敗理由 → API エラーレスポンスへのマッピング
 *   - 成功時の通知送信 (fire-and-forget)
 *
 * Server Action (`recordPurchase`) も同じ core を呼ぶため、エラーコードや
 * protocol_fee 計算、smart-contract 判定などの挙動は完全に一致する。
 */
export const POST = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;

  let body: PurchaseRequestBody;
  try {
    body = (await request.json()) as PurchaseRequestBody;
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid request body");
  }

  const txHash = typeof body.tx_hash === "string" ? body.tx_hash : "";
  if (!txHash.trim()) {
    return apiError(API_ERRORS.BAD_REQUEST, "Missing or invalid tx_hash");
  }

  // 明示的に渡された不正値は 400 にする (silent fallback で意図しない token/chain
  // で記録されるのを防ぐ)。省略時だけ defaults を適用する。core が現時点で対応
  // するのは Solana 上の SOL/USDC のみ。
  let token: Token;
  if (body.token === undefined) {
    token = "SOL";
  } else if (body.token === "SOL" || body.token === "USDC") {
    token = body.token;
  } else {
    return apiError(API_ERRORS.BAD_REQUEST, "Unsupported token");
  }

  let chain: Chain;
  if (body.chain === undefined) {
    chain = "solana";
  } else if (body.chain === "solana") {
    chain = body.chain;
  } else {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Only Solana purchase verification is supported in this phase",
    );
  }

  const admin = getAdminClient();

  const result = await recordPurchaseCore({
    admin,
    userId: user.userId,
    knowledgeId: id,
    txHash,
    token,
    chain,
  });

  if (!result.ok) {
    return mapCoreFailure(result);
  }

  if (result.created) {
    // 新規購入のみ通知を送る (idempotent replay は skip)
    const buyerName = result.buyerProfile.display_name || "購入者";
    const amount =
      typeof result.transaction.amount === "number"
        ? result.transaction.amount
        : Number(result.transaction.amount ?? 0);
    notifyPurchase(
      result.item.seller_id,
      buyerName,
      { id: result.item.id, title: result.item.title ?? "" },
      amount,
      result.transaction.token as Token,
    ).catch((err: unknown) =>
      console.error("[purchase] send notification failed:", {
        userId: result.item.seller_id,
        itemId: id,
        error: err,
      }),
    );
  }

  return apiSuccess(result.transaction);
}, { requiredPermissions: ["write"] });
