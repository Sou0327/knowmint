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

const TX_SELECT_COLUMNS =
  "id, buyer_id, seller_id, knowledge_item_id, amount, token, chain, tx_hash, status, protocol_fee, fee_vault_address, created_at, updated_at" as const;

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
    .select("id, title, seller_id, listing_type, status, price_sol, price_usdc")
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
    .select(TX_SELECT_COLUMNS)
    .eq("tx_hash", tx_hash.trim())
    .maybeSingle();

  if (existingByHashError) {
    console.error("[purchase] check tx hash failed:", { userId: user.userId, itemId: id, error: existingByHashError });
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  if (existingByHash) {
    if (
      existingByHash.buyer_id === user.userId &&
      existingByHash.knowledge_item_id === id
    ) {
      if (existingByHash.status === "confirmed") {
        return apiSuccess(existingByHash);
      }
      // pending: 再 confirm を試行
      if (existingByHash.status === "pending") {
        const { data: retryCount, error: retryError } = await admin.rpc("confirm_transaction", {
          tx_id: existingByHash.id,
        });
        if (retryError) {
          console.error("[purchase] retry confirm failed:", { txId: existingByHash.id, error: retryError });
          return apiError(API_ERRORS.BAD_REQUEST, "Transaction confirmation retry failed");
        }
        if (retryCount === 1) {
          // purchase_count インクリメントは RPC 内部で完了。再読込不要
          return apiSuccess({ ...existingByHash, status: 'confirmed' as const });
        }
        // 0 の場合: 別の並行リクエストが先行した可能性 → 再読込で確認
        const { data: retriedTx, error: recheckError } = await admin
          .from("transactions")
          .select(TX_SELECT_COLUMNS)
          .eq("id", existingByHash.id)
          .single();
        if (recheckError) {
          console.error("[purchase] retry recheck failed:", { txId: existingByHash.id, error: recheckError });
          return apiError(API_ERRORS.INTERNAL_ERROR);
        }
        if (retriedTx?.status === "confirmed") {
          return apiSuccess(retriedTx);
        }
        return apiError(API_ERRORS.BAD_REQUEST, "Transaction confirmation retry failed");
      }
    }

    return apiError(API_ERRORS.CONFLICT, "Transaction hash is already used");
  }

  // Resolve buyer/seller wallets and verify on-chain details before DB write
  const { data: walletProfiles, error: walletError } = await admin
    .from("profiles")
    .select("id, wallet_address, display_name")
    .in("id", [item.seller_id, user.userId]);

  if (walletError || !walletProfiles || walletProfiles.length < 2) {
    console.error("[purchase] fetch wallet profiles failed:", { userId: user.userId, itemId: id, error: walletError });
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  const rawSellerWallet = walletProfiles.find((p) => p.id === item.seller_id)?.wallet_address;
  const rawBuyerWallet = walletProfiles.find((p) => p.id === user.userId)?.wallet_address;

  if (!rawSellerWallet || !rawBuyerWallet) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Buyer and seller wallet addresses must be configured before purchase verification"
    );
  }

  // canonical PublicKey 形式に変換（不正フォーマットは例外 → 500 返却）
  let sellerWallet: string;
  let buyerWallet: string;
  try {
    sellerWallet = new PublicKey(rawSellerWallet).toBase58();
    buyerWallet = new PublicKey(rawBuyerWallet).toBase58();
  } catch {
    return apiError(API_ERRORS.INTERNAL_ERROR, "Invalid wallet address format");
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
    console.error("[purchase] tx verification failed:", { userId: user.userId, itemId: id, error: verification.error });
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Transaction verification failed"
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
    .select(TX_SELECT_COLUMNS)
    .single();

  if (txError) {
    if (txError.code === "23505") {
      return apiError(
        API_ERRORS.CONFLICT,
        "Transaction already exists or duplicate purchase"
      );
    }
    console.error("[purchase] create transaction failed:", { userId: user.userId, itemId: id, error: txError });
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  // Confirm transaction via RPC (purchase_count インクリメントも原子的に実行)
  // RPC は実際に pending→confirmed に遷移した件数 (0 or 1) を返す
  const { data: confirmCount, error: confirmError } = await admin.rpc("confirm_transaction", {
    tx_id: transaction.id,
  });

  if (confirmError) {
    // B2: Do not leak internal error details
    console.error("[purchase] confirm_transaction rpc failed:", { userId: user.userId, itemId: id, error: confirmError });
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Transaction verification failed"
    );
  }

  if (confirmCount !== 1) {
    // 0: pending でなかった (別の並行リクエストが先行した可能性) → 再読込で確認
    const { data: recheckTx, error: recheckError } = await admin
      .from("transactions")
      .select(TX_SELECT_COLUMNS)
      .eq("id", transaction.id)
      .single();
    if (recheckError || !recheckTx) {
      console.error("[purchase] recheck failed after 0-row confirm", { userId: user.userId, itemId: id, txId: transaction.id });
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }
    if (recheckTx.status !== "confirmed") {
      console.error("[purchase] confirm_transaction updated 0 rows and status not confirmed", { userId: user.userId, itemId: id, txId: transaction.id });
      return apiError(API_ERRORS.BAD_REQUEST, "Transaction confirmation failed");
    }
    // 並行リクエストが先行: send effects and return
    notifyPurchase(
      item.seller_id,
      walletProfiles.find((p) => p.id === user.userId)?.display_name || "購入者",
      { id: item.id, title: item.title },
      expectedAmount,
      token
    ).catch((err: unknown) =>
      console.error("[purchase] send notification failed:", { userId: item.seller_id, itemId: id, error: err })
    );
    fireWebhookEvent(user.userId, "purchase.completed", {
      knowledge_id: id,
      transaction_id: transaction.id,
      amount: expectedAmount,
      token,
    }).catch((err: unknown) => console.error("[purchase] webhook dispatch failed:", { userId: user.userId, itemId: id, error: err }));
    logAuditEvent({ userId: user.userId, action: "purchase.completed", resourceType: "knowledge_item", resourceId: id, metadata: { txHash: tx_hash.trim() } });
    return apiSuccess(recheckTx);
  }

  // Happy path: confirmCount === 1, purchase_count は RPC 内部で原子的に完了
  // Notify seller about the purchase (fire-and-forget)
  notifyPurchase(
    item.seller_id,
    walletProfiles.find((p) => p.id === user.userId)?.display_name || "購入者",
    { id: item.id, title: item.title },
    expectedAmount,
    token
  ).catch((err: unknown) =>
    console.error("[purchase] send notification failed:", { userId: item.seller_id, itemId: id, error: err })
  );

  fireWebhookEvent(user.userId, "purchase.completed", {
    knowledge_id: id,
    transaction_id: transaction.id,
    amount: expectedAmount,
    token,
  }).catch((err: unknown) => console.error("[purchase] webhook dispatch failed:", { userId: user.userId, itemId: id, error: err }));

  logAuditEvent({
    userId: user.userId,
    action: "purchase.completed",
    resourceType: "knowledge_item",
    resourceId: id,
    metadata: { txHash: tx_hash.trim() },
  });

  // INSERT 済みの transaction から confirmed 状態を構築 (余分な再 SELECT を回避)
  return apiSuccess({ ...transaction, status: 'confirmed' as const });
}, { requiredPermissions: ["write"] });
