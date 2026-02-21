import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import {
  apiSuccess,
  apiError,
  apiPaginated,
  API_ERRORS,
} from "@/lib/api/response";
import type {
  ContentType,
  KnowledgeStatus,
  ListingType,
} from "@/types/database.types";
import type { KnowledgeSearchParams } from "@/types/knowledge.types";
import {
  buildRequestFullContent,
  buildRequestPreviewContent,
  normalizeRequestContent,
  type RequestContentInput,
} from "@/lib/knowledge/requestContent";

const VALID_CONTENT_TYPES: ContentType[] = [
  "prompt",
  "tool_def",
  "dataset",
  "api",
  "general",
];
const VALID_LISTING_TYPES: ListingType[] = ["offer", "request"];

import { sanitizeMetadata } from "@/lib/knowledge/metadata";

/**
 * GET /api/v1/knowledge
 *
 * Query parameters:
 * - query, category, content_type, listing_type, min_price, max_price
 * - sort_by: "newest" | "popular" | "price_low" | "price_high" | "rating"
 * - page (default: 1), per_page (default: 20, max: 100)
 * - metadata_domain, metadata_experience_type, metadata_applicable_to, metadata_source_type
 */
export const GET = withApiAuth(async (request) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const contentTypeRaw = searchParams.get("content_type") ?? undefined;
  const content_type = contentTypeRaw as ContentType | undefined;
  const listingTypeRaw = searchParams.get("listing_type") ?? undefined;
  const listing_type = listingTypeRaw as ListingType | undefined;
  const min_price_raw = searchParams.get("min_price") ? parseFloat(searchParams.get("min_price")!) : undefined;
  const max_price_raw = searchParams.get("max_price") ? parseFloat(searchParams.get("max_price")!) : undefined;
  if ((min_price_raw !== undefined && !Number.isFinite(min_price_raw)) ||
      (max_price_raw !== undefined && !Number.isFinite(max_price_raw))) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid price parameter");
  }
  const min_price = min_price_raw;
  const max_price = max_price_raw;
  const sort_by = (searchParams.get("sort_by") ??
    "newest") as KnowledgeSearchParams["sort_by"];
  const page = Math.min(1000, Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1));
  const per_page = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("per_page") ?? "20", 10) || 20)
  );
  const metadata_domain = searchParams.get("metadata_domain") ?? undefined;
  const metadata_experience_type = searchParams.get("metadata_experience_type") ?? undefined;
  const metadata_applicable_to = searchParams.get("metadata_applicable_to") ?? undefined;
  const metadata_source_type = searchParams.get("metadata_source_type") ?? undefined;

  if (contentTypeRaw && !VALID_CONTENT_TYPES.includes(contentTypeRaw as ContentType)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid content_type");
  }

  if (listingTypeRaw && !VALID_LISTING_TYPES.includes(listingTypeRaw as ListingType)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid listing_type");
  }

  const supabase = getAdminClient();

  // Build query — count: "estimated" for performance (C2)
  let queryBuilder = supabase
    .from("knowledge_items")
    .select(
      `
      id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc,
      preview_content, category_id, tags, status, view_count, purchase_count,
      average_rating, metadata, usefulness_score, created_at, updated_at,
      seller:profiles!seller_id(id, display_name, avatar_url, trust_score),
      category:categories(id, name, slug)
      `,
      { count: "estimated" }
    )
    .eq("status", "published" as KnowledgeStatus);

  if (query) {
    queryBuilder = queryBuilder.textSearch("search_vector", query, {
      type: "websearch",
    });
  }
  if (category) {
    queryBuilder = queryBuilder.eq("categories.slug", category);
  }
  if (content_type) {
    queryBuilder = queryBuilder.eq("content_type", content_type);
  }
  if (listing_type) {
    queryBuilder = queryBuilder.eq("listing_type", listing_type);
  }
  if (min_price !== undefined) {
    queryBuilder = queryBuilder.gte("price_sol", min_price);
  }
  if (max_price !== undefined) {
    queryBuilder = queryBuilder.lte("price_sol", max_price);
  }
  if (metadata_domain) {
    queryBuilder = queryBuilder.eq("metadata->>domain", metadata_domain);
  }
  if (metadata_experience_type) {
    queryBuilder = queryBuilder.eq("metadata->>experience_type", metadata_experience_type);
  }
  if (metadata_source_type) {
    queryBuilder = queryBuilder.eq("metadata->>source_type", metadata_source_type);
  }
  if (metadata_applicable_to) {
    // GIN (jsonb_path_ops) インデックスを活用するため metadata 全体の @> で検索
    queryBuilder = queryBuilder.contains("metadata", { applicable_to: [metadata_applicable_to] });
  }

  // trust_score は profiles テーブルにあるため PostgREST で直接 ORDER BY できない。
  // trust_score ソート時は DB 側でページングせず、上限件数分を取得して
  // アプリ側でソート+ページングを行うことで、ページ間の順序整合性を保つ。
  const isTrustScoreSort = sort_by === "trust_score";
  const TRUST_SCORE_FETCH_LIMIT = 200;

  switch (sort_by) {
    case "newest":
      queryBuilder = queryBuilder.order("created_at", { ascending: false });
      break;
    case "popular":
      queryBuilder = queryBuilder.order("purchase_count", {
        ascending: false,
      });
      break;
    case "price_low":
      queryBuilder = queryBuilder.order("price_sol", {
        ascending: true,
        nullsFirst: false,
      });
      break;
    case "price_high":
      queryBuilder = queryBuilder.order("price_sol", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "rating":
      queryBuilder = queryBuilder.order("average_rating", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "trust_score":
      queryBuilder = queryBuilder.order("created_at", { ascending: false });
      break;
    default:
      queryBuilder = queryBuilder.order("created_at", { ascending: false });
  }

  if (isTrustScoreSort) {
    // trust_score ソート: ページングせず上限件数まで取得
    queryBuilder = queryBuilder.limit(TRUST_SCORE_FETCH_LIMIT);
  } else {
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    queryBuilder = queryBuilder.range(from, to);
  }

  const { data, count, error } = await queryBuilder;

  if (error) {
    console.error("Failed to fetch knowledge items:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  let resultData = data ?? [];

  if (isTrustScoreSort) {
    // seller.trust_score 降順でソート (null は末尾)
    resultData = [...resultData].sort((a, b) => {
      const scoreA = (a as { seller?: { trust_score?: number | null } }).seller?.trust_score ?? -1;
      const scoreB = (b as { seller?: { trust_score?: number | null } }).seller?.trust_score ?? -1;
      return scoreB - scoreA;
    });
    // アプリ側でページング
    const from = (page - 1) * per_page;
    resultData = resultData.slice(from, from + per_page);
    return apiPaginated(resultData, Math.min(count ?? 0, TRUST_SCORE_FETCH_LIMIT), page, per_page);
  }

  return apiPaginated(resultData, count ?? 0, page, per_page);
}, { requiredPermissions: ["read"] });

/**
 * POST /api/v1/knowledge
 * Creates a new knowledge item (status: draft)
 */
export const POST = withApiAuth(async (request, user) => {
  let body: {
    listing_type?: ListingType;
    title?: string;
    description?: string;
    content_type?: ContentType;
    price_sol?: number | null;
    price_usdc?: number | null;
    preview_content?: string;
    full_content?: string;
    request_content?: RequestContentInput;
    category_id?: string;
    tags?: string[];
    metadata?: {
      domain?: string;
      experience_type?: string;
      applicable_to?: string[];
      source_type?: string;
    } | null;
  };

  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  if (
    !body.title ||
    !body.description ||
    !body.content_type ||
    typeof body.title !== "string" ||
    typeof body.description !== "string"
  ) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Missing or invalid required fields: title, description, content_type"
    );
  }

  if (!VALID_CONTENT_TYPES.includes(body.content_type)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid content_type");
  }

  if (body.listing_type && !VALID_LISTING_TYPES.includes(body.listing_type)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid listing_type");
  }

  const listingType = body.listing_type ?? "offer";
  let normalizedRequestContent: ReturnType<typeof normalizeRequestContent> | null =
    null;

  if (listingType === "request") {
    const requestContent = body.request_content;
    if (!requestContent || typeof requestContent !== "object") {
      return apiError(
        API_ERRORS.BAD_REQUEST,
        "Missing required field: request_content"
      );
    }

    normalizedRequestContent = normalizeRequestContent(requestContent);
    if (!normalizedRequestContent.needed_info) {
      return apiError(
        API_ERRORS.BAD_REQUEST,
        "Field request_content.needed_info is required"
      );
    }
    if (!normalizedRequestContent.background) {
      return apiError(
        API_ERRORS.BAD_REQUEST,
        "Field request_content.background is required"
      );
    }
    if (
      normalizedRequestContent.needed_info.length > 5000 ||
      normalizedRequestContent.background.length > 5000 ||
      normalizedRequestContent.delivery_conditions.length > 5000 ||
      normalizedRequestContent.notes.length > 5000
    ) {
      return apiError(
        API_ERRORS.BAD_REQUEST,
        "request_content fields must be 5000 characters or fewer"
      );
    }
  }

  if (body.full_content !== undefined && typeof body.full_content !== "string") {
    return apiError(API_ERRORS.BAD_REQUEST, "full_content must be a string");
  }
  if (typeof body.full_content === "string" && body.full_content.length > 500_000) {
    return apiError(API_ERRORS.BAD_REQUEST, "full_content must be ≤ 500,000 characters");
  }

  const previewContent =
    listingType === "request"
      ? buildRequestPreviewContent(normalizedRequestContent!)
      : (body.preview_content ?? null);
  const fullContent =
    listingType === "request"
      ? buildRequestFullContent(normalizedRequestContent!)
      : body.full_content;

  const supabase = getAdminClient();

  const { data: knowledgeItem, error: insertError } = await supabase
    .from("knowledge_items")
    .insert({
      seller_id: user.userId,
      listing_type: listingType,
      title: body.title,
      description: body.description,
      content_type: body.content_type,
      price_sol: body.price_sol ?? null,
      price_usdc: body.price_usdc ?? null,
      preview_content: previewContent,
      category_id: body.category_id ?? null,
      tags: body.tags ?? [],
      status: "draft" as KnowledgeStatus,
      metadata: sanitizeMetadata(body.metadata),
    })
    .select(
      `
      id, seller_id, listing_type, title, description, content_type, price_sol, price_usdc,
      preview_content, category_id, tags, status, view_count, purchase_count,
      average_rating, metadata, usefulness_score, created_at, updated_at
      `
    )
    .single();

  if (insertError || !knowledgeItem) {
    console.error("Failed to insert knowledge item:", insertError);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  if (fullContent) {
    const { error: contentError } = await supabase
      .from("knowledge_item_contents")
      .insert({
        knowledge_item_id: knowledgeItem.id,
        full_content: fullContent,
        file_url: null,
      });

    if (contentError) {
      console.error("Failed to insert content:", contentError);
      await supabase
        .from("knowledge_items")
        .delete()
        .eq("id", knowledgeItem.id);
      return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to save content");
    }
  }

  return apiSuccess(knowledgeItem, 201);
}, { requiredPermissions: ["write"] });
