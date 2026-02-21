import type {
  ContentType,
  KnowledgeItem,
  KnowledgeStatus,
  Profile,
  Review,
  Category,
  ListingType,
} from "./database.types";

export interface KnowledgeMetadataForm {
  domain: string;
  experience_type: string;
  applicable_to: string[];
  source_type: string;
}

// Form data for creating/editing knowledge items
export interface KnowledgeFormData {
  title: string;
  description: string;
  listing_type: ListingType;
  content_type: ContentType;
  price_sol: number | null;
  price_usdc: number | null;
  preview_content: string;
  full_content: string;
  file: File | null;
  category_id: string;
  tags: string[];
  metadata: KnowledgeMetadataForm;
}

// Knowledge item with seller profile joined
export interface KnowledgeWithSeller extends KnowledgeItem {
  seller: Pick<Profile, "id" | "display_name" | "avatar_url" | "trust_score">;
  category: Pick<Category, "id" | "name" | "slug"> | null;
}

// Knowledge item with reviews
export interface KnowledgeWithReviews extends KnowledgeWithSeller {
  reviews: (Review & {
    reviewer: Pick<Profile, "id" | "display_name" | "avatar_url">;
  })[];
}

// Search/filter params
export interface KnowledgeSearchParams {
  query?: string;
  category?: string;
  content_type?: ContentType;
  listing_type?: ListingType;
  min_price?: number;
  max_price?: number;
  sort_by?: "newest" | "popular" | "price_low" | "price_high" | "rating" | "trust_score";
  status?: KnowledgeStatus;
  page?: number;
  per_page?: number;
  metadata_domain?: string;
  metadata_experience_type?: string;
  metadata_applicable_to?: string;
  metadata_source_type?: string;
}

// Paginated response
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Content type labels
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  prompt: "テキスト・記事",
  tool_def: "テンプレート・設定",
  dataset: "データ・資料",
  api: "リンク・外部リソース",
  general: "その他ナレッジ",
};

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  offer: "出品",
  request: "募集",
};

// Status labels
export const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  draft: "下書き",
  published: "公開中",
  archived: "アーカイブ",
  suspended: "停止中",
};
