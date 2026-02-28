import { createClient } from "@/lib/supabase/server";
import type { ContentType, ListingType } from "@/types/database.types";

/** お気に入り一覧の戻り値型 */
export interface FavoriteWithItem {
  id: string;
  knowledge_item_id: string;
  created_at: string;
  knowledge_item: {
    id: string;
    listing_type: ListingType;
    title: string;
    description: string;
    content_type: ContentType;
    price_sol: number | null;
    price_usdc: number | null;
    tags: string[];
    average_rating: number | null;
    purchase_count: number;
    seller: { id: string; display_name: string | null; avatar_url: string | null } | null;
    category: { id: string; name: string; slug: string } | null;
  } | null;
}

import { toSingle } from "@/lib/supabase/utils";

export async function getFavorites(userId: string): Promise<FavoriteWithItem[]> {
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

  if (!data) return [];

  return data.map((row) => {
    const rawItem = toSingle(row.knowledge_item);
    return {
      id: row.id,
      knowledge_item_id: row.knowledge_item_id,
      created_at: row.created_at,
      knowledge_item: rawItem
        ? {
            ...rawItem,
            seller: toSingle(rawItem.seller),
            category: toSingle(rawItem.category),
          }
        : null,
    };
  }) as FavoriteWithItem[];
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
