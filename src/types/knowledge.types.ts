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

// Trust score thresholds
export const TRUST_HIGH_THRESHOLD = 0.8;
export const TRUST_THRESHOLD = 0.5;

// Exhaustive content type record → array derivation
const CONTENT_TYPE_MAP: Record<ContentType, true> = {
  prompt: true,
  tool_def: true,
  dataset: true,
  api: true,
  general: true,
};
export const CONTENT_TYPES = Object.keys(CONTENT_TYPE_MAP) as ContentType[];

// i18n key types for type-safe translation lookups
type ContentDisplayKey = `contentDisplayLabel.${ContentType}`;
type ListingTypeKey = `listingType.${ListingType}`;
type StatusKey = `status.${KnowledgeStatus}`;

// i18n helper: t is from useTranslations("Types") or getTranslations("Types")
export function getContentDisplayLabel(
  type: ContentType,
  t: (key: ContentDisplayKey) => string,
): string {
  return t(`contentDisplayLabel.${type}`);
}

export function getListingTypeLabel(
  type: ListingType,
  t: (key: ListingTypeKey) => string,
): string {
  return t(`listingType.${type}`);
}

export function getStatusLabel(
  status: KnowledgeStatus,
  t: (key: StatusKey) => string,
): string {
  return t(`status.${status}`);
}
