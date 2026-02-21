import type { Token, Transaction, KnowledgeItem } from "./database.types";

// Dashboard overview statistics
export interface DashboardStats {
  totalListings: number;
  publishedCount: number;
  draftCount: number;
  totalRevenue: Record<Token, number>;
  totalSales: number;
}

// Sales aggregated by date
export interface SalesByDate {
  date: string;
  amount: number;
  token: Token;
}

// Revenue breakdown by token
export interface RevenueByToken {
  token: Token;
  total: number;
  count: number;
}

// Top selling knowledge item
export interface TopSellingItem {
  id: string;
  title: string;
  salesCount: number;
  revenueByToken: Partial<Record<Token, number>>;
  averageRating: number | null;
}

// Recent transaction with item info
export interface RecentTransaction extends Transaction {
  knowledge_item: Pick<KnowledgeItem, "id" | "title" | "content_type"> | null;
}
