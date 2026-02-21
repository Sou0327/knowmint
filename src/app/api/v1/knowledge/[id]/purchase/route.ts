import { PublicKey } from "@solana/web3.js";
import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { notifyPurchase } from "@/lib/notifications/create";
import { fireWebhookEvent } from "@/lib/webhooks/events";
import { logAuditEvent } from "@/lib/audit/log";
import type { Chain, Token } from "@/types/database.types";
import {
  isValidSolanaTxHash,
  verifySolanaPurchaseTransaction,
} from "@/lib/solana/verify-transaction";

function isValidSolanaPublicKey(addr: string): boolean {
  try { new PublicKey(addr); return true; } catch { return false; }
}

interface PurchaseRequestBody {
  tx_hash: string;
  amount?: number;
  token?: Token;
  chain?: Chain;
}

/**
 * POST /api/v1/knowledge/[id]/purchase
 * Records a purchase transaction.
 * Critical fix (B1): amount is derived from DB price, not client body.
 */
export const POST = withApiAuth(async (request, user, _rateLimit, context) => {
  const { id } = await context!.params;

  let body: PurchaseRequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const { tx_hash, token = "SOL", chain = "solana" } = body;

  if (!tx_hash || typeof tx_hash !== "string" || tx_hash.trim() === "") {
    return apiError(API_ERRORS.BAD_REQUEST, "Missing or invalid tx_hash");
  }

  if (chain !== "solana") {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Only Solana purchase verification is supported in this phase"
    );
  }

  if (token !== "SOL" && token !== "USDC") {
    return apiError(API_ERRORS.BAD_REQUEST, "Unsupported token for Solana chain");
  }

  if (!isValidSolanaTxHash(tx_hash.trim())) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid Solana transaction hash format");
  }

  const admin = getAdminClient();

  // Fetch knowledge item
  const { data: item, error: itemError } = await admin
    .from("knowledge_items")
    .select("id, seller_id, listing_type, status, price_sol, price_usdc")
    .eq("id", id)
    .single();

  if (itemError || !item) {
    return apiError(API_ERRORS.NOT_FOUND, "Knowledge item not found");
  }

  if (item.status !== "published") {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "This item is not available for purchase"
    );
  }

  if (item.listing_type === "request") {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Request listings cannot be purchased"
    );
  }

  if (item.seller_id === user.userId) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "You cannot purchase your own item"
    );
  }

  // B1: Determine expected amount from DB price (ignore client-supplied amount)
  const expectedAmount = token === "USDC" ? item.price_usdc : item.price_sol;
  if (
    expectedAmount === null ||
    expectedAmount === undefined ||
    expectedAmount <= 0
  ) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "This item has no price set for the selected token"
    );
  }

  // Check for duplicate confirmed purchase
  const { data: existingTx } = await admin
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.userId)
    .eq("knowledge_item_id", id)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();

  if (existingTx) {
    return apiError(
      API_ERRORS.CONFLICT,
      "You have already purchased this item"
    );
  }

  // Idempotency by tx_hash
  const { data: existingByHash, error: existingByHashError } = await admin
    .from("transactions")
    .select()
    .eq("tx_hash", tx_hash.trim())
    .maybeSingle();

  if (existingByHashError) {
    console.error("Failed to check existing transaction hash:", existingByHashError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  if (existingByHash) {
    if (
      existingByHash.buyer_id === user.userId &&
      existingByHash.knowledge_item_id === id
    ) {
      // select() で全フィールド取得済みなので再クエリ不要（N+1 解消）
      return apiSuccess(existingByHash);
    }

    return apiError(API_ERRORS.CONFLICT, "Transaction hash is already used");
  }

  // Resolve buyer/seller wallets and verify on-chain details before DB write
  const { data: walletProfiles, error: walletError } = await admin
    .from("profiles")
    .select("id, wallet_address")
    .in("id", [item.seller_id, user.userId]);

  if (walletError || !walletProfiles || walletProfiles.length < 2) {
    console.error("Failed to fetch wallet profiles:", walletError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  const sellerWallet = walletProfiles.find((p) => p.id === item.seller_id)?.wallet_address;
  const buyerWallet = walletProfiles.find((p) => p.id === user.userId)?.wallet_address;

  if (!sellerWallet || !buyerWallet) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Buyer and seller wallet addresses must be configured before purchase verification"
    );
  }

  // フロントと同じ条件: programId と feeVault の両方が有効な PublicKey 形式の場合のみ split 検証
  const rawProgramId = process.env.NEXT_PUBLIC_KM_PROGRAM_ID?.trim() || "";
  const rawFeeVault = process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS?.trim() || "";
  // フロントと同じ基準: new PublicKey() でパース成功するアドレスのみ有効
  const smartContractEnabled =
    isValidSolanaPublicKey(rawProgramId) && isValidSolanaPublicKey(rawFeeVault);
  const feeVaultAddress = smartContractEnabled ? rawFeeVault : undefined;
  const programId = smartContractEnabled ? rawProgramId : undefined;

  const verification = await verifySolanaPurchaseTransaction({
    txHash: tx_hash.trim(),
    token,
    expectedRecipient: sellerWallet,
    expectedAmount,
    expectedSender: buyerWallet,
    feeVaultAddress,
    programId,
  });

  if (!verification.valid) {
    console.error("Transaction verification failed:", verification.error);
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "トランザクション検証に失敗しました"
    );
  }

  // Insert pending transaction with DB-sourced amount
  const { data: transaction, error: txError } = await admin
    .from("transactions")
    .insert({
      buyer_id: user.userId,
      seller_id: item.seller_id,
      knowledge_item_id: id,
      amount: expectedAmount,
      token,
      chain,
      tx_hash: tx_hash.trim(),
      status: "pending",
      // オンチェーンと同じ丸め方式: fee = total - floor(total * 9500 / 10000)
      // (SOL=9桁, USDC=6桁)  ← Math.floor(5%) では1 atomic単位ズレるケースがある
      protocol_fee: (() => {
        if (!feeVaultAddress) return 0;
        const decimals = token === "USDC" ? 6 : 9;
        const atomicTotal = Math.round(expectedAmount * 10 ** decimals);
        const sellerAtomic = Math.floor(atomicTotal * 9500 / 10000);
        const feeAtomic = atomicTotal - sellerAtomic;
        return feeAtomic / 10 ** decimals;
      })(),
      fee_vault_address: feeVaultAddress || null,
    })
    .select()
    .single();

  if (txError) {
    if (txError.code === "23505") {
      return apiError(
        API_ERRORS.CONFLICT,
        "Transaction already exists or duplicate purchase"
      );
    }
    console.error("Failed to create transaction:", txError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  // Confirm transaction via RPC
  const { error: confirmError } = await admin.rpc("confirm_transaction", {
    tx_id: transaction.id,
  });

  if (confirmError) {
    // B2: Do not leak internal error details
    console.error("Transaction verification failed:", confirmError);
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Transaction verification failed"
    );
  }

  // Increment purchase count (fire-and-forget with error handler) (D1)
  admin
    .rpc("increment_purchase_count", { item_id: id })
    .then(
      () => {},
      (err: unknown) =>
        console.error("Failed to increment purchase count:", err)
    );

  // Notify seller about the purchase (fire-and-forget)
  admin
    .from("knowledge_items")
    .select("id, title")
    .eq("id", id)
    .single()
    .then(
      ({ data: itemData }) => {
        if (itemData) {
          notifyPurchase(
            item.seller_id,
            "購入者",
            { id: itemData.id, title: itemData.title },
            expectedAmount,
            token
          ).catch((err: unknown) =>
            console.error("Failed to send purchase notification:", err)
          );
        }
      },
      (err: unknown) =>
        console.error("Failed to fetch item for notification:", err)
    );

  // Fetch updated transaction
  const { data: confirmedTx } = await admin
    .from("transactions")
    .select()
    .eq("id", transaction.id)
    .single();

  // Fire webhook event (fire-and-forget)
  fireWebhookEvent(user.userId, "purchase.completed", {
    knowledge_id: id,
    transaction_id: transaction.id,
    amount: expectedAmount,
    token,
  }).catch((err: unknown) => console.error("Webhook purchase.completed:", err));

  logAuditEvent({
    userId: user.userId,
    action: "purchase.completed",
    resourceType: "knowledge_item",
    resourceId: id,
    metadata: { txHash: tx_hash.trim() },
  });

  return apiSuccess(confirmedTx || transaction);
}, { requiredPermissions: ["write"] });
