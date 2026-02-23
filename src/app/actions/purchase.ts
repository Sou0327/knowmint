"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import {
  isValidSolanaTxHash,
  verifySolanaPurchaseTransaction,
} from "@/lib/solana/verify-transaction";

function isValidSolanaPublicKey(addr: string): boolean {
  try { new PublicKey(addr); return true; } catch { return false; }
}

const schema = z
  .object({
    knowledgeId: z.string().uuid(),
    txHash: z.string().min(1).max(256),
    chain: z.enum(["solana", "base", "ethereum"]),
    token: z.enum(["SOL", "USDC", "ETH"]),
    termsAgreed: z.literal(true, {
      errorMap: () => ({ message: "利用規約への同意が必要です" }),
    }),
  })
  .refine(
    (d) =>
      d.chain === "solana"
        ? d.token === "SOL" || d.token === "USDC"
        : d.token === "ETH",
    { message: "Invalid chain/token combination" }
  );

export async function recordPurchase(
  knowledgeId: string,
  txHash: string,
  chain: "solana" | "base" | "ethereum",
  token: "SOL" | "USDC" | "ETH",
  termsAgreed: true
): Promise<{ success: boolean; error?: string }> {
  const parsed = schema.safeParse({ knowledgeId, txHash, chain, token, termsAgreed });
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const admin = getAdminClient();

  // 冪等性: confirmed 済み購入を先に確認 (不要なオンチェーン検証を回避)
  const { data: confirmedTx } = await admin
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("knowledge_item_id", knowledgeId)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();

  if (confirmedTx) return { success: true };

  // 同一 tx_hash の既存レコードを確認 (pending/failed 含む)
  const { data: existing, error: existingError } = await admin
    .from("transactions")
    .select("id, buyer_id, knowledge_item_id, status")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (existingError) {
    console.error("[recordPurchase] idempotency check error", existingError);
    return { success: false, error: "Database error" };
  }

  if (existing) {
    // 同一 buyer + 同一アイテム + confirmed → 冪等成功
    if (
      existing.buyer_id === user.id &&
      existing.knowledge_item_id === knowledgeId &&
      existing.status === "confirmed"
    ) {
      return { success: true };
    }
    // pending (処理中) または別 buyer/アイテムへの再利用は拒否
    return { success: false, error: "Transaction hash already used" };
  }

  // EVM購入は price_eth 実装まで非対応 (既存 /api/v1 purchase route と同様)
  if (chain !== "solana") {
    return { success: false, error: "Only Solana purchases are supported in this phase" };
  }

  // tx_hash フォーマット検証 (base58, 87-88 文字)
  if (!isValidSolanaTxHash(txHash)) {
    return { success: false, error: "Invalid Solana transaction hash format" };
  }

  // アイテムの存在・ステータス・seller_id・価格チェック
  const { data: item, error: itemError } = await admin
    .from("knowledge_items")
    .select("id, seller_id, status, listing_type, price_sol, price_usdc")
    .eq("id", knowledgeId)
    .single();

  if (itemError || !item || item.status !== "published") {
    return { success: false, error: "Item not found or not available" };
  }
  if (item.listing_type === "request") {
    return { success: false, error: "Request listings cannot be purchased" };
  }
  if (item.seller_id === user.id) {
    return { success: false, error: "Cannot purchase your own item" };
  }

  // DB 価格から amount を導出 (クライアント入力値は使用しない)
  const amount = token === "USDC" ? item.price_usdc : item.price_sol;
  if (amount === null || amount === undefined || amount <= 0) {
    return { success: false, error: "Item has no price set for the selected token" };
  }

  // オンチェーン検証: buyer/seller ウォレットアドレスを取得
  const { data: walletProfiles, error: walletError } = await admin
    .from("profiles")
    .select("id, wallet_address")
    .in("id", [item.seller_id, user.id]);

  if (walletError || !walletProfiles || walletProfiles.length < 2) {
    console.error("[recordPurchase] fetch wallet profiles failed", walletError);
    return { success: false, error: "Failed to resolve wallet addresses" };
  }

  const rawSellerWallet = walletProfiles.find((p) => p.id === item.seller_id)?.wallet_address;
  const rawBuyerWallet = walletProfiles.find((p) => p.id === user.id)?.wallet_address;

  if (!rawSellerWallet || !rawBuyerWallet) {
    return { success: false, error: "Buyer and seller wallet addresses must be configured" };
  }

  let sellerWallet: string;
  let buyerWallet: string;
  try {
    sellerWallet = new PublicKey(rawSellerWallet).toBase58();
    buyerWallet = new PublicKey(rawBuyerWallet).toBase58();
  } catch {
    return { success: false, error: "Invalid wallet address format" };
  }

  // スマートコントラクトが有効な場合のみ split 検証
  const rawProgramId = process.env.NEXT_PUBLIC_KM_PROGRAM_ID?.trim() || "";
  const rawFeeVault = process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS?.trim() || "";
  const smartContractEnabled =
    isValidSolanaPublicKey(rawProgramId) && isValidSolanaPublicKey(rawFeeVault);
  const feeVaultAddress = smartContractEnabled ? rawFeeVault : undefined;
  const programId = smartContractEnabled ? rawProgramId : undefined;

  const verification = await verifySolanaPurchaseTransaction({
    txHash,
    token,
    expectedRecipient: sellerWallet,
    expectedAmount: amount,
    expectedSender: buyerWallet,
    feeVaultAddress,
    programId,
  });

  if (!verification.valid) {
    console.error("[recordPurchase] tx verification failed", { userId: user.id, knowledgeId, error: verification.error });
    return { success: false, error: "トランザクション検証に失敗しました" };
  }

  // 購入レコード挿入 (DB unique 制約が race condition を防ぐ)
  const { data: transaction, error: insertError } = await admin.from("transactions").insert({
    buyer_id: user.id,
    seller_id: item.seller_id,
    knowledge_item_id: knowledgeId,
    amount,
    token,
    chain,
    tx_hash: txHash,
    status: "pending",
    protocol_fee: feeVaultAddress ? (() => {
      const decimals = token === "USDC" ? 6 : 9;
      const atomicTotal = Math.round(amount * 10 ** decimals);
      const sellerAtomic = Math.floor(atomicTotal * 9500 / 10000);
      return (atomicTotal - sellerAtomic) / 10 ** decimals;
    })() : null,
    fee_vault_address: feeVaultAddress || null,
  }).select("id").single();

  if (insertError || !transaction) {
    // 23505: unique violation — race condition で別リクエストが先に挿入した可能性
    if (insertError?.code === "23505") {
      const { data: recheck } = await admin
        .from("transactions")
        .select("id, buyer_id, knowledge_item_id, status")
        .eq("tx_hash", txHash)
        .maybeSingle();
      if (
        recheck &&
        recheck.buyer_id === user.id &&
        recheck.knowledge_item_id === knowledgeId &&
        recheck.status === "confirmed"
      ) {
        return { success: true };
      }
      return { success: false, error: "Transaction hash already used" };
    }
    console.error("[recordPurchase] insert error", insertError);
    return { success: false, error: "Failed to record purchase" };
  }

  // confirm_transaction RPC で pending → confirmed に昇格
  const { error: confirmError } = await admin.rpc("confirm_transaction", {
    tx_id: transaction.id,
  });

  if (confirmError) {
    console.error("[recordPurchase] confirm_transaction rpc failed", { userId: user.id, knowledgeId, error: confirmError });
    return { success: false, error: "Transaction confirmation failed" };
  }

  return { success: true };
}
