import { getAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

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

  // Get sellers with confirmed transaction counts.
  // TODO: Replace with SQL GROUP BY aggregation (RPC/view) when transaction volume grows.
  // Current approach caps at 5000 rows as a safety bound.
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("seller_id")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (txError) {
    console.error("[rankings] getTopSellers transactions query failed:", txError.message);
    return [];
  }
  if (!transactions || transactions.length === 0) return [];

  // Count sales per seller
  const salesCount = new Map<string, number>();
  for (const tx of transactions) {
    salesCount.set(tx.seller_id, (salesCount.get(tx.seller_id) ?? 0) + 1);
  }

  // Get top seller IDs by sales count
  const topSellerIds = Array.from(salesCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topSellerIds.length === 0) return [];

  // Fetch profiles
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, follower_count, trust_score")
    .in("id", topSellerIds);

  if (profileError) {
    console.error("[rankings] getTopSellers profiles query failed:", profileError.message);
    return [];
  }
  if (!profiles) return [];

  // Get item counts per seller
  const { data: items, error: itemError } = await supabase
    .from("knowledge_items")
    .select("seller_id")
    .eq("status", "published")
    .in("seller_id", topSellerIds);

  if (itemError) {
    console.error("[rankings] getTopSellers items query failed:", itemError.message);
    return [];
  }

  const itemCount = new Map<string, number>();
  items?.forEach((item) => {
    itemCount.set(item.seller_id, (itemCount.get(item.seller_id) ?? 0) + 1);
  });

  // Combine and sort
  const results: TopSeller[] = profiles.map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    follower_count: profile.follower_count ?? 0,
    total_sales: salesCount.get(profile.id) ?? 0,
    total_items: itemCount.get(profile.id) ?? 0,
    trust_score: profile.trust_score ?? null,
  }));

  results.sort((a, b) => b.total_sales - a.total_sales);

  return results;
}
