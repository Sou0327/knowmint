import { createClient } from "@/lib/supabase/server";

export async function hasAccess(
  userId: string,
  knowledgeItemId: string
): Promise<boolean> {
  const supabase = await createClient();

  // Check if user is the seller
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("seller_id")
    .eq("id", knowledgeItemId)
    .single();

  if (item?.seller_id === userId) return true;

  // Check if user has a confirmed purchase
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id")
    .eq("buyer_id", userId)
    .eq("knowledge_item_id", knowledgeItemId)
    .eq("status", "confirmed")
    .limit(1)
    .single();

  return !!transaction;
}
