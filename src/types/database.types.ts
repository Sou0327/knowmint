/**
 * 手書きドメイン型 — フラット named import の後方互換レイヤー。
 * truth source は database.generated.ts (supabase gen types --local)。
 * 将来的にこのファイルは generated.ts の re-export + カスタム型のみに縮小予定。
 */

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

// Moderation status
export type ModerationStatus = "none" | "under_review" | "removed";

// Audit action
export type AuditAction =
  | "key.created"
  | "key.deleted"
  | "purchase.completed"
  | "feedback.created"
  | "listing.published"
  | "webhook.created"
  | "webhook.deleted"
  | "report.created"
  | "report.reviewed"
  | "agent.registered"
  | "agent.login";

// Report reason
export type ReportReason = "spam" | "illegal" | "misleading" | "inappropriate" | "copyright" | "other";

// Report status
export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

// Webhook delivery log status
export type WebhookDeliveryStatus = "failed" | "dead";

// Auth challenge purpose
export type AuthChallengePurpose = "register" | "login";

// Notification type
export type NotificationType = "purchase" | "review" | "follow" | "new_listing";

// Database row types
export type Profile = {
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
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  icon: string | null;
  created_at: string;
};

export type KnowledgeItemMetadata = {
  domain?: string;
  experience_type?: string;
  applicable_to?: string[];
  source_type?: string;
};

export type KnowledgeItem = {
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
  moderation_status: ModerationStatus;
  view_count: number;
  purchase_count: number;
  average_rating: number | null;
  metadata: KnowledgeItemMetadata | null;
  usefulness_score: number | null;
  seller_disclosure: string | null;
  search_vector: unknown;
  created_at: string;
  updated_at: string;
};

export type KnowledgeFeedback = {
  id: string;
  knowledge_item_id: string;
  buyer_id: string;
  transaction_id: string;
  useful: boolean;
  usage_context: string | null;
  created_at: string;
};

export type KnowledgeItemVersion = {
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
};

// コンテンツ分離テーブル（購入者/売り手のみアクセス可）
export type KnowledgeItemContent = {
  id: string;
  knowledge_item_id: string;
  full_content: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
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
};

export type Review = {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  knowledge_item_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type WebhookSubscription = {
  id: string;
  user_id: string;
  url: string;
  events: string[];
  secret: string | null;
  secret_hash: string | null;
  secret_encrypted: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ApiKey = {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  permissions: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
};

export type Favorite = {
  id: string;
  user_id: string;
  knowledge_item_id: string;
  created_at: string;
};

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Phase 14: 監査ログ
export type AuditLog = {
  id: string;
  user_id: string | null;
  action: AuditAction;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Phase 21: ウォレットチャレンジ (SIWS)
export type WalletChallenge = {
  id: string;
  user_id: string;
  nonce: string;
  wallet: string;
  expires_at: string;
  created_at: string;
};

// Phase 19: コンテンツ報告
export type KnowledgeItemReport = {
  id: string;
  knowledge_item_id: string;
  reporter_id: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  reviewer_id: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

// Phase 17: Webhook 配信ログ (DLQ)
export type WebhookDeliveryLog = {
  id: string;
  subscription_id: string;
  event: string;
  attempt: number;
  status: WebhookDeliveryStatus;
  status_code: number | null;
  error_message: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

// Phase 40: 認証チャレンジ (エージェント自律オンボーディング)
export type AuthChallenge = {
  id: string;
  wallet: string;
  nonce: string;
  purpose: AuthChallengePurpose;
  expires_at: string;
  created_at: string;
};

// Supabase Database 型定義
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>;
        Relationships: [
          { foreignKeyName: "profiles_id_fkey"; columns: ["id"]; isOneToOne: true; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at">;
        Update: Partial<Omit<Category, "id" | "created_at">>;
        Relationships: [];
      };
      knowledge_items: {
        Row: KnowledgeItem;
        Insert: Omit<
          KnowledgeItem,
          | "id"
          | "moderation_status"
          | "view_count"
          | "purchase_count"
          | "average_rating"
          | "search_vector"
          | "created_at"
          | "updated_at"
        >;
        Update: Partial<
          Omit<
            KnowledgeItem,
            | "id"
            | "seller_id"
            | "view_count"
            | "purchase_count"
            | "average_rating"
            | "search_vector"
            | "created_at"
            | "updated_at"
          >
        >;
        Relationships: [
          { foreignKeyName: "knowledge_items_seller_id_fkey"; columns: ["seller_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "knowledge_items_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "categories"; referencedColumns: ["id"] },
        ];
      };
      knowledge_item_contents: {
        Row: KnowledgeItemContent;
        Insert: Omit<KnowledgeItemContent, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<KnowledgeItemContent, "id" | "created_at" | "updated_at">>;
        Relationships: [
          { foreignKeyName: "knowledge_item_contents_knowledge_item_id_fkey"; columns: ["knowledge_item_id"]; isOneToOne: false; referencedRelation: "knowledge_items"; referencedColumns: ["id"] },
        ];
      };
      knowledge_item_versions: {
        Row: KnowledgeItemVersion;
        Insert: Omit<KnowledgeItemVersion, "id" | "created_at">;
        Update: Partial<Omit<KnowledgeItemVersion, "id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "knowledge_item_versions_knowledge_item_id_fkey"; columns: ["knowledge_item_id"]; isOneToOne: false; referencedRelation: "knowledge_items"; referencedColumns: ["id"] },
        ];
      };
      knowledge_feedbacks: {
        Row: KnowledgeFeedback;
        Insert: Omit<KnowledgeFeedback, "id" | "created_at">;
        Update: Partial<Omit<KnowledgeFeedback, "id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "knowledge_feedbacks_knowledge_item_id_fkey"; columns: ["knowledge_item_id"]; isOneToOne: false; referencedRelation: "knowledge_items"; referencedColumns: ["id"] },
          { foreignKeyName: "knowledge_feedbacks_transaction_id_fkey"; columns: ["transaction_id"]; isOneToOne: false; referencedRelation: "transactions"; referencedColumns: ["id"] },
        ];
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Transaction, "id" | "buyer_id" | "created_at" | "updated_at">>;
        Relationships: [
          { foreignKeyName: "transactions_knowledge_item_id_fkey"; columns: ["knowledge_item_id"]; isOneToOne: false; referencedRelation: "knowledge_items"; referencedColumns: ["id"] },
        ];
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Review, "id" | "reviewer_id" | "created_at" | "updated_at">>;
        Relationships: [
          { foreignKeyName: "reviews_knowledge_item_id_fkey"; columns: ["knowledge_item_id"]; isOneToOne: false; referencedRelation: "knowledge_items"; referencedColumns: ["id"] },
          { foreignKeyName: "reviews_reviewer_id_fkey"; columns: ["reviewer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "reviews_transaction_id_fkey"; columns: ["transaction_id"]; isOneToOne: false; referencedRelation: "transactions"; referencedColumns: ["id"] },
        ];
      };
      api_keys: {
        Row: ApiKey;
        Insert: Omit<ApiKey, "id" | "created_at">;
        Update: Partial<Omit<ApiKey, "id" | "user_id" | "created_at">>;
        Relationships: [];
      };
      favorites: {
        Row: Favorite;
        Insert: Omit<Favorite, "id" | "created_at">;
        Update: Partial<Omit<Favorite, "id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "favorites_knowledge_item_id_fkey"; columns: ["knowledge_item_id"]; isOneToOne: false; referencedRelation: "knowledge_items"; referencedColumns: ["id"] },
        ];
      };
      follows: {
        Row: Follow;
        Insert: Omit<Follow, "id" | "created_at">;
        Update: Partial<Omit<Follow, "id" | "created_at">>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at">;
        Update: Partial<Omit<Notification, "id" | "created_at">>;
        Relationships: [];
      };
      webhook_subscriptions: {
        Row: WebhookSubscription;
        Insert: Omit<WebhookSubscription, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<WebhookSubscription, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at">;
        Update: Partial<Omit<AuditLog, "id" | "created_at">>;
        Relationships: [];
      };
      wallet_challenges: {
        Row: WalletChallenge;
        Insert: Omit<WalletChallenge, "id" | "created_at">;
        Update: Partial<Omit<WalletChallenge, "id" | "created_at">>;
        Relationships: [];
      };
      knowledge_item_reports: {
        Row: KnowledgeItemReport;
        Insert: Omit<KnowledgeItemReport, "id" | "status" | "reviewer_id" | "reviewer_note" | "reviewed_at" | "created_at">;
        Update: Partial<Omit<KnowledgeItemReport, "id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "knowledge_item_reports_knowledge_item_id_fkey"; columns: ["knowledge_item_id"]; isOneToOne: false; referencedRelation: "knowledge_items"; referencedColumns: ["id"] },
        ];
      };
      webhook_delivery_logs: {
        Row: WebhookDeliveryLog;
        Insert: Omit<WebhookDeliveryLog, "id" | "created_at">;
        Update: Partial<Omit<WebhookDeliveryLog, "id" | "created_at">>;
        Relationships: [];
      };
      auth_challenges: {
        Row: AuthChallenge;
        Insert: Omit<AuthChallenge, "id" | "created_at">;
        Update: Partial<Omit<AuthChallenge, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      confirm_transaction: {
        Args: { tx_id: string };
        Returns: undefined;
      };
      increment_view_count: {
        Args: { item_id: string };
        Returns: undefined;
      };
      increment_purchase_count: {
        Args: { item_id: string };
        Returns: undefined;
      };
      update_average_rating: {
        Args: { item_id: string };
        Returns: undefined;
      };
      create_notification: {
        Args: {
          p_user_id: string;
          p_type: string;
          p_title: string;
          p_message: string;
          p_link?: string | null;
          p_metadata?: Record<string, unknown>;
        };
        Returns: string;
      };
      consume_wallet_challenge: {
        Args: { p_nonce: string; p_user_id: string; p_wallet: string };
        Returns: string;
      };
      create_version_snapshot: {
        Args: {
          p_knowledge_item_id: string;
          p_title: string;
          p_description: string;
          p_preview_content: string | null;
          p_price_sol: number | null;
          p_price_usdc: number | null;
          p_tags: string[];
          p_metadata: Record<string, unknown> | null;
          p_full_content: string | null;
          p_changed_by: string;
          p_change_summary: string | null;
        };
        Returns: { id: string; version_number: number };
      };
      maybe_flag_for_review: {
        Args: { p_item_id: string };
        Returns: undefined;
      };
      admin_review_report: {
        Args: {
          p_report_id: string;
          p_new_status: string;
          p_reviewer_id: string;
          p_reviewer_note: string;
          p_remove_item: boolean;
        };
        Returns: undefined;
      };
      consume_auth_challenge: {
        Args: { p_wallet: string; p_nonce: string; p_purpose: string };
        Returns: string;
      };
    };
    Enums: {
      content_type: ContentType;
      knowledge_status: KnowledgeStatus;
      transaction_status: TransactionStatus;
      chain_type: Chain;
      token_type: Token;
      profile_user_type: UserType;
      listing_type: ListingType;
      moderation_status: ModerationStatus;
      report_reason: ReportReason;
      report_status: ReportStatus;
      webhook_delivery_status: WebhookDeliveryStatus;
      auth_challenge_purpose: AuthChallengePurpose;
      notification_type: NotificationType;
      audit_action: AuditAction;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
