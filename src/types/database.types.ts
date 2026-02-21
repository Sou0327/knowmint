// Content type enum
export type ContentType = "prompt" | "tool_def" | "dataset" | "api" | "general";
export type UserType = "human" | "agent";
export type ListingType = "offer" | "request";

// Knowledge item status
export type KnowledgeStatus = "draft" | "published" | "archived" | "suspended";

// Transaction status
export type TransactionStatus = "pending" | "confirmed" | "failed" | "refunded";

// Supported blockchain
export type Chain = "solana" | "base" | "ethereum";

// Supported token
export type Token = "SOL" | "USDC" | "ETH";

// Database row types
export interface Profile {
  id: string;
  display_name: string | null;
  user_type: UserType;
  avatar_url: string | null;
  wallet_address: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  trust_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string | null;
  created_at: string;
}

export interface KnowledgeItemMetadata {
  domain?: string;
  experience_type?: string;
  applicable_to?: string[];
  source_type?: string;
}

export interface KnowledgeItem {
  id: string;
  seller_id: string;
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  price_sol: number | null;
  price_usdc: number | null;
  preview_content: string | null;
  category_id: string | null;
  tags: string[];
  status: KnowledgeStatus;
  view_count: number;
  purchase_count: number;
  average_rating: number | null;
  metadata: KnowledgeItemMetadata | null;
  usefulness_score: number | null;
  search_vector: unknown;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeFeedback {
  id: string;
  knowledge_item_id: string;
  buyer_id: string;
  transaction_id: string;
  useful: boolean;
  usage_context: string | null;
  created_at: string;
}

export interface KnowledgeItemVersion {
  id: string;
  knowledge_item_id: string;
  version_number: number;
  title: string;
  description: string;
  preview_content: string | null;
  price_sol: number | null;
  price_usdc: number | null;
  tags: string[];
  metadata: KnowledgeItemMetadata | null;
  full_content: string | null;
  changed_by: string;
  change_summary: string | null;
  created_at: string;
}

// コンテンツ分離テーブル（購入者/売り手のみアクセス可）
export interface KnowledgeItemContent {
  id: string;
  knowledge_item_id: string;
  full_content: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  buyer_id: string;
  seller_id: string;
  knowledge_item_id: string;
  amount: number;
  token: Token;
  chain: Chain;
  tx_hash: string;
  status: TransactionStatus;
  protocol_fee: number | null;
  fee_vault_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  knowledge_item_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

// Supabase Database 型定義
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile };
      categories: { Row: Category };
      knowledge_items: { Row: KnowledgeItem };
      knowledge_item_contents: { Row: KnowledgeItemContent };
      knowledge_item_versions: { Row: KnowledgeItemVersion };
      knowledge_feedbacks: { Row: KnowledgeFeedback };
      transactions: { Row: Transaction };
      reviews: { Row: Review };
      api_keys: { Row: ApiKey };
      favorites: { Row: Favorite };
      follows: { Row: Follow };
      notifications: { Row: Notification };
    };
  };
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  permissions: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface Favorite {
  id: string;
  user_id: string;
  knowledge_item_id: string;
  created_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export type NotificationType = 'purchase' | 'review' | 'follow' | 'new_listing';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}
