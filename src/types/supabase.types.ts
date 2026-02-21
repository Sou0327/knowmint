import type {
  Profile,
  Category,
  KnowledgeItem,
  Transaction,
  Review,
  ApiKey,
  UserType,
  ListingType,
} from "./database.types";

// Supabase Database type definitions (matches schema)
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at">;
        Update: Partial<Omit<Category, "id" | "created_at">>;
      };
      knowledge_items: {
        Row: KnowledgeItem;
        Insert: Omit<
          KnowledgeItem,
          | "id"
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
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<Transaction, "id" | "buyer_id" | "created_at" | "updated_at">
        >;
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<Review, "id" | "reviewer_id" | "created_at" | "updated_at">
        >;
      };
      api_keys: {
        Row: ApiKey;
        Insert: Omit<ApiKey, "id" | "created_at">;
        Update: Partial<Omit<ApiKey, "id" | "user_id" | "created_at">>;
      };
    };
    Enums: {
      content_type: "prompt" | "tool_def" | "dataset" | "api" | "general";
      knowledge_status: "draft" | "published" | "archived" | "suspended";
      transaction_status: "pending" | "confirmed" | "failed" | "refunded";
      chain_type: "solana" | "base" | "ethereum";
      token_type: "SOL" | "USDC" | "ETH";
      profile_user_type: UserType;
      listing_type: ListingType;
    };
  };
};
