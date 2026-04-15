import { createClient } from "@/lib/supabase/server";

/**
 * L-6: 2ラウンドトリップ → 1クエリに統合
 * - knowledge_items と transactions を同時に取得し、seller_id 判定 OR 購入済み判定を1往復で解決
 */
export async function hasAccess(
  userId: string,
  knowledgeItemId: string
): Promise<boolean> {
  const supabase = await createClient();

  // seller_id チェックと購入済みチェックを並列実行 (1ネットワークRTT)
  const [itemResult, txResult] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select("seller_id")
      .eq("id", knowledgeItemId)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id")
      .eq("buyer_id", userId)
      .eq("knowledge_item_id", knowledgeItemId)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle(),
  ]);

  if (itemResult.data?.seller_id === userId) return true;
  return !!txResult.data;
}
