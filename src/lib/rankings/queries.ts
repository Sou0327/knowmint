import { getAdminClient } from "@/lib/supabase/admin";

export interface TopSeller {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  total_sales: number;
  total_items: number;
  trust_score: number | null;
}

/**
 * Lightweight existence check — only fetches a single transaction row.
 * Used in generateMetadata to decide noindex without loading full seller data.
 * Uses admin client to bypass RLS (transactions are restricted by buyer/seller).
 */
export async function hasAnySellers(): Promise<boolean> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[rankings] hasAnySellers query failed:", error.message);
    // Fail open: assume sellers exist so we don't accidentally noindex /rankings
    return true;
  }
  return data !== null;
}

export async function getTopSellers(limit = 10): Promise<TopSeller[]> {
  const supabase = getAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase typed RPC: custom function not in generated Database.Functions
  const { data, error } = await (supabase.rpc as any)("get_top_sellers", {
    p_limit: limit,
  });

  if (error) {
    console.error("[rankings] getTopSellers RPC failed:", error.message);
    return [];
  }
  if (!data || !Array.isArray(data) || data.length === 0) return [];

  return (data as Array<{
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    follower_count: number;
    total_sales: number;
    total_items: number;
    trust_score: number | null;
  }>).map((row) => ({
    id: row.id,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    follower_count: row.follower_count ?? 0,
    total_sales: Number(row.total_sales),
    total_items: Number(row.total_items),
    trust_score: row.trust_score ?? null,
  }));
}
