import { createClient } from "@/lib/supabase/server";

/**
 * 指定ユーザーがフォローしているユーザー一覧を取得
 */
export async function getFollowing(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("id, following_id, created_at, following:profiles!following_id(id, display_name, avatar_url, bio, follower_count)")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * 指定ユーザーをフォローしているユーザー一覧を取得
 */
export async function getFollowers(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("id, follower_id, created_at, follower:profiles!follower_id(id, display_name, avatar_url)")
    .eq("following_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * フォロー関係を確認
 */
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}

/**
 * フォロワー数を取得
 */
export async function getFollowerCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("follower_count")
    .eq("id", userId)
    .single();
  return data?.follower_count ?? 0;
}
