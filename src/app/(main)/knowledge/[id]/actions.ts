"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { confirmTransaction, verifyTransactionDetails } from "@/lib/solana/confirm";

const purchaseSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  txHash: z.string().min(32).max(128),
  token: z.enum(["SOL", "USDC", "ETH"]),
  chain: z.enum(["solana", "base", "ethereum"]),
});

const reviewSchema = z.object({
  knowledgeItemId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().default(""),
});

export async function recordPurchase(params: {
  knowledgeItemId: string;
  txHash: string;
  token: string;
  chain: string;
}) {
  // Zod バリデーション
  const parsed = purchaseSchema.safeParse(params);
  if (!parsed.success) {
    return { error: "入力が不正です: " + parsed.error.issues[0]?.message };
  }

  const { knowledgeItemId, txHash, token, chain } = parsed.data;
  const user = await requireAuth();
  const supabase = await createClient();

  // Get knowledge item to find seller and DB price
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("seller_id, listing_type, title, price_sol, price_usdc")
    .eq("id", knowledgeItemId)
    .single();

  if (!item) {
    return { error: "アイテムが見つかりません" };
  }

  if (item.seller_id === user.id) {
    return { error: "自分のアイテムは購入できません" };
  }

  if (item.listing_type === "request") {
    return { error: "募集掲載は購入できません" };
  }

  // DB の価格を使用（クライアントの amount を信用しない）
  const amount = token === "SOL" ? item.price_sol : item.price_usdc;
  if (!amount || amount <= 0) {
    return { error: "このトークンでの価格が設定されていません" };
  }

  // Check for duplicate transaction
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("tx_hash", txHash)
    .single();

  if (existing) {
    return { error: "このトランザクションは既に記録されています" };
  }

  // Verify on-chain transaction
  const { confirmed, error: confirmError } = await confirmTransaction(txHash);

  if (!confirmed) {
    return { error: confirmError || "トランザクション確認に失敗しました", confirmed: false };
  }

  // オンチェーンで送金先・金額を検証（SOL のみ、USDC は別途実装要）
  if (token === "SOL") {
    // seller の wallet_address を取得
    const { data: sellerProfile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", item.seller_id)
      .single();

    if (sellerProfile?.wallet_address) {
      const { data: buyerProfile } = await supabase
        .from("profiles")
        .select("wallet_address")
        .eq("id", user.id)
        .single();

      if (buyerProfile?.wallet_address) {
        const { valid, error: verifyError } = await verifyTransactionDetails(
          txHash,
          sellerProfile.wallet_address,
          amount,
          buyerProfile.wallet_address
        );

        if (!valid) {
          return { error: verifyError || "トランザクション検証に失敗しました" };
        }
      }
    }
  }

  // Record transaction as pending（RLS で pending のみ INSERT 可能）
  const { error: insertError } = await supabase.from("transactions").insert({
    buyer_id: user.id,
    seller_id: item.seller_id,
    knowledge_item_id: knowledgeItemId,
    amount,
    token,
    chain,
    tx_hash: txHash,
    status: "pending",
  });

  if (insertError) {
    return { error: insertError.message };
  }

  // confirmed なら RPC でステータス更新（SECURITY DEFINER）
  // トランザクション ID を取得
  const { data: txRecord } = await supabase
    .from("transactions")
    .select("id")
    .eq("tx_hash", txHash)
    .single();

  if (txRecord) {
    await supabase.rpc("confirm_transaction", { tx_id: txRecord.id });
    await supabase.rpc("increment_purchase_count", { item_id: knowledgeItemId });
  }

  return { error: null, confirmed: true };
}

export async function submitReview(params: {
  knowledgeItemId: string;
  rating: number;
  comment: string;
}) {
  // Zod バリデーション
  const parsed = reviewSchema.safeParse(params);
  if (!parsed.success) {
    return { error: "入力が不正です: " + parsed.error.issues[0]?.message };
  }

  const { knowledgeItemId, rating, comment } = parsed.data;
  const user = await requireAuth();
  const supabase = await createClient();

  // Find the user's transaction for this item
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("knowledge_item_id", knowledgeItemId)
    .eq("status", "confirmed")
    .single();

  if (!transaction) {
    return { error: "購入済みのアイテムのみレビューできます" };
  }

  // Check for existing review
  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("transaction_id", transaction.id)
    .single();

  if (existingReview) {
    return { error: "既にレビュー済みです" };
  }

  const { error } = await supabase.from("reviews").insert({
    transaction_id: transaction.id,
    reviewer_id: user.id,
    knowledge_item_id: knowledgeItemId,
    rating,
    comment: comment || null,
  });

  if (error) {
    return { error: error.message };
  }

  // 平均レーティング更新
  await supabase.rpc("update_average_rating", { item_id: knowledgeItemId });

  return { error: null };
}
