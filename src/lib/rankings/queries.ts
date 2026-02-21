import { createClient } from "@/lib/supabase/server";

export interface TopSeller {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  total_sales: number;
  total_items: number;
  trust_score: number | null;
}

export async function getTopSellers(limit = 10): Promise<TopSeller[]> {
  const supabase = await createClient();

  // Get sellers with confirmed transaction counts
  const { data: transactions } = await supabase
    .from("transactions")
    .select("seller_id")
    .eq("status", "confirmed");

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
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, follower_count, trust_score")
    .in("id", topSellerIds);

  if (!profiles) return [];

  // Get item counts per seller
  const { data: items } = await supabase
    .from("knowledge_items")
    .select("seller_id")
    .eq("status", "published")
    .in("seller_id", topSellerIds);

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
