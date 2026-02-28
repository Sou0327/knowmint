import { createClient } from "@/lib/supabase/server";
import type {
  DashboardStats,
  RecentTransaction,
  SalesByDate,
  TopSellingItem,
} from "@/types/dashboard.types";
import type { Chain, ContentType, Token, TransactionStatus } from "@/types/database.types";
import { toSingle } from "@/lib/supabase/utils";

export async function getDashboardStats(
  userId: string
): Promise<DashboardStats> {
  const supabase = await createClient();

  // Fetch listing counts by status
  const { data: items } = await supabase
    .from("knowledge_items")
    .select("status")
    .eq("seller_id", userId);

  const totalListings = items?.length ?? 0;
  const publishedCount =
    items?.filter((i) => i.status === "published").length ?? 0;
  const draftCount = items?.filter((i) => i.status === "draft").length ?? 0;

  // Fetch confirmed transactions for revenue (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, token")
    .eq("seller_id", userId)
    .eq("status", "confirmed")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const totalRevenue: Record<Token, number> = { SOL: 0, USDC: 0, ETH: 0 };
  let totalSales = 0;

  transactions?.forEach((tx) => {
    totalRevenue[tx.token as Token] =
      (totalRevenue[tx.token as Token] ?? 0) + Number(tx.amount);
    totalSales++;
  });

  return {
    totalListings,
    publishedCount,
    draftCount,
    totalRevenue,
    totalSales,
  };
}

export async function getRecentTransactions(
  userId: string,
  limit = 5
): Promise<RecentTransaction[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("transactions")
    .select(
      "*, knowledge_item:knowledge_items(id, title, content_type)"
    )
    .eq("seller_id", userId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!data) return [];
  // nested join 正規化: knowledge_item は single join だが T | T[] 推論対策
  return data.map((row) => ({
    ...row,
    knowledge_item: toSingle(row.knowledge_item),
  })) as RecentTransaction[];
}

export async function getSalesByDateRange(
  userId: string,
  start: Date,
  end: Date
): Promise<SalesByDate[]> {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, token, created_at")
    .eq("seller_id", userId)
    .eq("status", "confirmed")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: true });

  if (!transactions) return [];

  // Aggregate by date
  const byDate = new Map<string, Map<Token, number>>();
  transactions.forEach((tx) => {
    const date = tx.created_at.split("T")[0];
    if (!byDate.has(date)) {
      byDate.set(date, new Map());
    }
    const tokenMap = byDate.get(date)!;
    const token = tx.token as Token;
    tokenMap.set(token, (tokenMap.get(token) ?? 0) + Number(tx.amount));
  });

  const result: SalesByDate[] = [];
  byDate.forEach((tokenMap, date) => {
    tokenMap.forEach((amount, token) => {
      result.push({ date, amount, token });
    });
  });

  return result;
}

export async function getTopSellingItems(
  userId: string,
  limit = 5
): Promise<TopSellingItem[]> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("knowledge_items")
    .select("id, title, purchase_count, average_rating")
    .eq("seller_id", userId)
    .eq("status", "published")
    .order("purchase_count", { ascending: false })
    .limit(limit);

  if (!items || items.length === 0) return [];

  // Get revenue per item per token from transactions
  const itemIds = items.map((i) => i.id);
  const { data: transactions } = await supabase
    .from("transactions")
    .select("knowledge_item_id, amount, token")
    .eq("seller_id", userId)
    .eq("status", "confirmed")
    .in("knowledge_item_id", itemIds);

  const revenueMap = new Map<string, Partial<Record<Token, number>>>();
  transactions?.forEach((tx) => {
    if (!revenueMap.has(tx.knowledge_item_id)) {
      revenueMap.set(tx.knowledge_item_id, {});
    }
    const byToken = revenueMap.get(tx.knowledge_item_id)!;
    const token = tx.token as Token;
    byToken[token] = (byToken[token] ?? 0) + Number(tx.amount);
  });

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    salesCount: item.purchase_count,
    revenueByToken: revenueMap.get(item.id) ?? {},
    averageRating: item.average_rating,
  }));
}

export interface PurchaseHistoryItem {
  id: string;
  knowledge_item_id: string;
  amount: number;
  token: Token;
  chain: Chain;
  tx_hash: string;
  status: TransactionStatus;
  created_at: string;
  knowledge_item: {
    id: string;
    title: string;
    content_type: ContentType;
  } | null;
}

export async function getPurchaseHistory(
  userId: string,
  days?: number
): Promise<PurchaseHistoryItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select(
      "id, knowledge_item_id, amount, token, chain, tx_hash, status, created_at, knowledge_item:knowledge_items(id, title, content_type)"
    )
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });

  if (days) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);
    query = query.gte("created_at", daysAgo.toISOString());
  }

  const { data } = await query;

  if (!data) return [];

  return data.map((item) => ({
    ...item,
    knowledge_item: toSingle(item.knowledge_item),
  })) as PurchaseHistoryItem[];
}
