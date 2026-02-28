import { createClient } from "@/lib/supabase/server";

export async function toggleFavorite(
  userId: string,
  itemId: string
): Promise<{ favorited: boolean }> {
  const supabase = await createClient();

  const { data: existing, error: selectError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("knowledge_item_id", itemId)
    .maybeSingle();

  if (selectError) throw new Error("Failed to check favorite status");

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("knowledge_item_id", itemId);
    if (error) throw new Error("Failed to remove favorite");
    return { favorited: false };
  }

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, knowledge_item_id: itemId });
  if (error) throw new Error("Failed to add favorite");
  return { favorited: true };
}
