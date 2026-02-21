import { createClient } from "@/lib/supabase/server";

export async function getFavorites(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select(
      `id, knowledge_item_id, created_at,
      knowledge_item:knowledge_items(
        id, listing_type, title, description, content_type, price_sol, price_usdc, tags,
        average_rating, purchase_count,
        seller:profiles!seller_id(id, display_name, avatar_url),
        category:categories(id, name, slug)
      )`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function isFavorited(
  userId: string,
  itemId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("knowledge_item_id", itemId)
    .maybeSingle();
  return !!data;
}
