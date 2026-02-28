import { createClient } from "@/lib/supabase/server";

export async function toggleFollow(
  followerId: string,
  followingId: string
): Promise<{ following: boolean }> {
  if (followerId === followingId) {
    throw new Error("Cannot follow yourself");
  }

  const supabase = await createClient();

  const { data: existing, error: selectError } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();

  if (selectError) throw new Error("Failed to check follow status");

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    if (error) throw new Error("Failed to unfollow");
    return { following: false };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw new Error("Failed to follow");
  return { following: true };
}
