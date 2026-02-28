export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          permissions: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name?: string
          permissions?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_challenges: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          nonce: string
          purpose: string
          wallet: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce: string
          purpose: string
          wallet: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          purpose?: string
          wallet?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          knowledge_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          knowledge_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          knowledge_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_feedbacks: {
        Row: {
          buyer_id: string
          created_at: string | null
          id: string
          knowledge_item_id: string
          transaction_id: string
          usage_context: string | null
          useful: boolean
        }
        Insert: {
          buyer_id: string
          created_at?: string | null
          id?: string
          knowledge_item_id: string
          transaction_id: string
          usage_context?: string | null
          useful: boolean
        }
        Update: {
          buyer_id?: string
          created_at?: string | null
          id?: string
          knowledge_item_id?: string
          transaction_id?: string
          usage_context?: string | null
          useful?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_feedbacks_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_feedbacks_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_feedbacks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_item_contents: {
        Row: {
          created_at: string
          file_url: string | null
          full_content: string | null
          id: string
          knowledge_item_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          full_content?: string | null
          id?: string
          knowledge_item_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          full_content?: string | null
          id?: string
          knowledge_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_item_contents_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: true
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_item_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          knowledge_item_id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          knowledge_item_id: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          knowledge_item_id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_item_reports_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_item_versions: {
        Row: {
          change_summary: string | null
          changed_by: string
          created_at: string | null
          description: string
          full_content: string | null
          id: string
          knowledge_item_id: string
          metadata: Json | null
          preview_content: string | null
          price_sol: number | null
          price_usdc: number | null
          tags: string[] | null
          title: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          changed_by: string
          created_at?: string | null
          description: string
          full_content?: string | null
          id?: string
          knowledge_item_id: string
          metadata?: Json | null
          preview_content?: string | null
          price_sol?: number | null
          price_usdc?: number | null
          tags?: string[] | null
          title: string
          version_number: number
        }
        Update: {
          change_summary?: string | null
          changed_by?: string
          created_at?: string | null
          description?: string
          full_content?: string | null
          id?: string
          knowledge_item_id?: string
          metadata?: Json | null
          preview_content?: string | null
          price_sol?: number | null
          price_usdc?: number | null
          tags?: string[] | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_item_versions_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_item_versions_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          average_rating: number | null
          category_id: string | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          description: string
          id: string
          listing_type: Database["public"]["Enums"]["listing_type"]
          metadata: Json | null
          moderation_status: string
          preview_content: string | null
          price_sol: number | null
          price_usdc: number | null
          purchase_count: number
          search_vector: unknown
          seller_disclosure: string | null
          seller_id: string
          status: Database["public"]["Enums"]["knowledge_status"]
          tags: string[] | null
          title: string
          updated_at: string
          usefulness_score: number | null
          view_count: number
        }
        Insert: {
          average_rating?: number | null
          category_id?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          description?: string
          id?: string
          listing_type?: Database["public"]["Enums"]["listing_type"]
          metadata?: Json | null
          moderation_status?: string
          preview_content?: string | null
          price_sol?: number | null
          price_usdc?: number | null
          purchase_count?: number
          search_vector?: unknown
          seller_disclosure?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["knowledge_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
          usefulness_score?: number | null
          view_count?: number
        }
        Update: {
          average_rating?: number | null
          category_id?: string | null
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          description?: string
          id?: string
          listing_type?: Database["public"]["Enums"]["listing_type"]
          metadata?: Json | null
          moderation_status?: string
          preview_content?: string | null
          price_sol?: number | null
          price_usdc?: number | null
          purchase_count?: number
          search_vector?: unknown
          seller_disclosure?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["knowledge_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
          usefulness_score?: number | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          follower_count: number
          following_count: number
          id: string
          trust_score: number | null
          updated_at: string
          user_type: Database["public"]["Enums"]["profile_user_type"]
          wallet_address: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id: string
          trust_score?: number | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["profile_user_type"]
          wallet_address?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          follower_count?: number
          following_count?: number
          id?: string
          trust_score?: number | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["profile_user_type"]
          wallet_address?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          knowledge_item_id: string
          rating: number
          reviewer_id: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          knowledge_item_id: string
          rating: number
          reviewer_id: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          knowledge_item_id?: string
          rating?: number
          reviewer_id?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          buyer_id: string
          chain: Database["public"]["Enums"]["chain_type"]
          created_at: string
          fee_vault_address: string | null
          id: string
          knowledge_item_id: string
          protocol_fee: number | null
          seller_id: string
          status: Database["public"]["Enums"]["transaction_status"]
          token: Database["public"]["Enums"]["token_type"]
          tx_hash: string
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          chain?: Database["public"]["Enums"]["chain_type"]
          created_at?: string
          fee_vault_address?: string | null
          id?: string
          knowledge_item_id: string
          protocol_fee?: number | null
          seller_id: string
          status?: Database["public"]["Enums"]["transaction_status"]
          token?: Database["public"]["Enums"]["token_type"]
          tx_hash: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          chain?: Database["public"]["Enums"]["chain_type"]
          created_at?: string
          fee_vault_address?: string | null
          id?: string
          knowledge_item_id?: string
          protocol_fee?: number | null
          seller_id?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          token?: Database["public"]["Enums"]["token_type"]
          tx_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_challenges: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          nonce: string
          user_id: string
          wallet: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce: string
          user_id: string
          wallet: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          user_id?: string
          wallet?: string
        }
        Relationships: []
      }
      webhook_delivery_logs: {
        Row: {
          attempt: number
          created_at: string
          error_message: string | null
          event: string
          id: string
          payload: Json
          status: string
          status_code: number | null
          subscription_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          error_message?: string | null
          event: string
          id?: string
          payload: Json
          status?: string
          status_code?: number | null
          subscription_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          error_message?: string | null
          event?: string
          id?: string
          payload?: Json
          status?: string
          status_code?: number | null
          subscription_id?: string
        }
        Relationships: []
      }
      webhook_subscriptions: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          secret: string | null
          secret_encrypted: string | null
          secret_hash: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string | null
          secret_encrypted?: string | null
          secret_hash?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string | null
          secret_encrypted?: string | null
          secret_hash?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_review_report: {
        Args: {
          p_new_status: string
          p_remove_item: boolean
          p_report_id: string
          p_reviewer_id: string
          p_reviewer_note: string
        }
        Returns: undefined
      }
      confirm_transaction: { Args: { tx_id: string }; Returns: undefined }
      consume_auth_challenge: {
        Args: { p_nonce: string; p_purpose: string; p_wallet: string }
        Returns: string
      }
      consume_wallet_challenge: {
        Args: { p_nonce: string; p_user_id: string; p_wallet: string }
        Returns: string
      }
      create_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_version_snapshot: {
        Args: {
          p_change_summary: string
          p_changed_by: string
          p_description: string
          p_full_content: string
          p_knowledge_item_id: string
          p_metadata: Json
          p_preview_content: string
          p_price_sol: number
          p_price_usdc: number
          p_tags: string[]
          p_title: string
        }
        Returns: Json
      }
      increment_purchase_count: {
        Args: { item_id: string }
        Returns: undefined
      }
      increment_view_count: { Args: { item_id: string }; Returns: undefined }
      maybe_flag_for_review: { Args: { p_item_id: string }; Returns: undefined }
      recalculate_trust_score: {
        Args: { seller_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_average_rating: { Args: { item_id: string }; Returns: undefined }
    }
    Enums: {
      chain_type: "solana" | "base" | "ethereum"
      content_type: "prompt" | "tool_def" | "dataset" | "api" | "general"
      knowledge_status: "draft" | "published" | "archived" | "suspended"
      listing_type: "offer" | "request"
      profile_user_type: "human" | "agent"
      token_type: "SOL" | "USDC" | "ETH"
      transaction_status: "pending" | "confirmed" | "failed" | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      chain_type: ["solana", "base", "ethereum"],
      content_type: ["prompt", "tool_def", "dataset", "api", "general"],
      knowledge_status: ["draft", "published", "archived", "suspended"],
      listing_type: ["offer", "request"],
      profile_user_type: ["human", "agent"],
      token_type: ["SOL", "USDC", "ETH"],
      transaction_status: ["pending", "confirmed", "failed", "refunded"],
    },
  },
} as const

