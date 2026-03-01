"use server";

import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { createVersionSnapshot } from "@/lib/knowledge/versions";
import { getCategories } from "@/lib/knowledge/queries";
import type { KnowledgeStatus } from "@/types/database.types";
import {
  buildRequestFullContent,
  buildRequestPreviewContent,
  normalizeRequestContent,
  type RequestContentInput,
} from "@/lib/knowledge/requestContent";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const requestContentSchema = z.object({
  needed_info: z
    .string()
    .trim()
    .min(1, "Required information is required")
    .max(5000, "Must be 5000 characters or less"),
  background: z
    .string()
    .trim()
    .min(1, "Background is required")
    .max(5000, "Must be 5000 characters or less"),
  delivery_conditions: z
    .string()
    .trim()
    .max(5000, "Must be 5000 characters or less")
    .default(""),
  notes: z
    .string()
    .trim()
    .max(5000, "Must be 5000 characters or less")
    .default(""),
});

const metadataSchema = z.object({
  domain: z.enum(["finance", "engineering", "marketing", "legal", "medical", "education", "other", ""]).default(""),
  experience_type: z.enum(["case_study", "how_to", "template", "checklist", "reference", "other", ""]).default(""),
  applicable_to: z.array(z.enum(["GPT-4", "Claude", "Gemini", "any"])).max(10).default([]),
  source_type: z.enum(["personal_experience", "research", "industry_standard", "other", ""]).default(""),
}).default({});

const listingSchemaBase = z.object({
  listing_type: z.enum(["offer", "request"]).default("offer"),
  title: z.string().trim().min(1, "Title is required").max(200, "Must be 200 characters or less"),
  description: z.string().trim().min(1, "Description is required").max(5000, "Must be 5000 characters or less"),
  content_type: z.enum(["prompt", "tool_def", "dataset", "api", "general"]),
  price_sol: z.number().min(0).max(1000000).nullable(),
  price_usdc: z.number().min(0).max(1000000).nullable(),
  preview_content: z.string().max(10000).default(""),
  full_content: z.string().max(100000).default(""),
  request_content: requestContentSchema.optional(),
  category_id: z.string().uuid().or(z.literal("")).default(""),
  tags: z.array(z.string().max(50)).max(10).default([]),
  metadata: metadataSchema.nullable().default(null),
  seller_disclosure: z.string().trim().max(500).optional(),
});

const listingSchema = listingSchemaBase.superRefine((data, ctx) => {
    if (data.listing_type === "request" && !data.request_content) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["request_content"],
        message: "Request details are required",
      });
    }
  });

const updateSchema = listingSchemaBase.partial().superRefine((data, ctx) => {
  if (data.listing_type === "request" && data.request_content === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["request_content"],
      message: "Request details are required when listing type is request",
    });
  }
});

export async function createListing(input: {
  listing_type: string;
  title: string;
  description: string;
  content_type: string;
  price_sol: number | null;
  price_usdc: number | null;
  preview_content: string;
  full_content: string;
  request_content?: RequestContentInput;
  category_id: string;
  tags: string[];
  metadata?: {
    domain?: string;
    experience_type?: string;
    applicable_to?: string[];
    source_type?: string;
  } | null;
  seller_disclosure?: string;
}) {
  const t = await getTranslations("Errors");

  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: t("invalidInput"), id: null };
  }

  const { full_content, request_content, metadata, seller_disclosure, ...itemData } = parsed.data;
  const user = await requireAuth();
  const supabase = await createClient();
  let previewContent = itemData.preview_content;
  let fullContent = full_content;

  // metadata から空文字フィールドを除去してサニタイズ（null は null のまま保持）
  let sanitizedMetadata: Record<string, unknown> | null = null;
  if (metadata) {
    const obj: Record<string, unknown> = {};
    if (metadata.domain) obj.domain = metadata.domain;
    if (metadata.experience_type) obj.experience_type = metadata.experience_type;
    if (metadata.applicable_to && metadata.applicable_to.length > 0) obj.applicable_to = metadata.applicable_to;
    if (metadata.source_type) obj.source_type = metadata.source_type;
    sanitizedMetadata = Object.keys(obj).length > 0 ? obj : null;
  }

  if (itemData.listing_type === "request") {
    if (!request_content) {
      return { error: t("requestContentRequired"), id: null };
    }
    const normalized = normalizeRequestContent(request_content);
    previewContent = buildRequestPreviewContent(normalized);
    fullContent = buildRequestFullContent(normalized);
  }

  // knowledge_items に挿入（full_content なし）
  const { data, error } = await supabase
    .from("knowledge_items")
    .insert({
      seller_id: user.id,
      listing_type: itemData.listing_type,
      title: itemData.title,
      description: itemData.description,
      content_type: itemData.content_type,
      price_sol: itemData.price_sol,
      price_usdc: itemData.price_usdc,
      preview_content: previewContent,
      category_id: itemData.category_id || null,
      tags: itemData.tags,
      status: "draft" as KnowledgeStatus,
      metadata: sanitizedMetadata,
      usefulness_score: null,
      seller_disclosure: seller_disclosure?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[listing] create failed:", error);
    return { error: t("listingCreateFailed"), id: null };
  }

  // コンテンツ分離テーブルに full_content を挿入
  if (fullContent) {
    const { error: contentError } = await supabase
      .from("knowledge_item_contents")
      .insert({
      knowledge_item_id: data.id,
      full_content: fullContent,
      file_url: null,
    });

    if (contentError) {
      console.error("[listing] content insert failed:", contentError);
      const { error: rollbackError } = await supabase
        .from("knowledge_items")
        .delete()
        .eq("id", data.id);
      if (rollbackError) {
        console.error("[listing] compensating delete failed — orphaned item:", data.id, rollbackError);
      }
      return {
        error: t("contentSaveFailed"),
        id: null,
      };
    }
  }

  return { error: null, id: data.id };
}

export async function updateListing(id: string, input: Record<string, unknown>) {
  const t = await getTranslations("Errors");

  if (!UUID_RE.test(id)) {
    return { error: t("invalidInput") };
  }

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: t("invalidInput") };
  }

  const { full_content, request_content, metadata, seller_disclosure: rawDisclosure, ...itemData } = parsed.data;
  const user = await requireAuth();
  const supabase = await createClient();
  let fullContent = full_content;

  // 所有権を事前検証（content 更新パスでも確実にチェック）
  const { data: owned, error: ownerError } = await supabase
    .from("knowledge_items")
    .select("id")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (ownerError) {
    console.error("[listing] ownership check failed:", ownerError);
    return { error: t("listingUpdateFailed") };
  }
  if (!owned) {
    return { error: t("itemNotFound") };
  }

  if (request_content) {
    const normalized = normalizeRequestContent(request_content);
    itemData.preview_content = buildRequestPreviewContent(normalized);
    fullContent = buildRequestFullContent(normalized);
  }

  // metadata サニタイズ
  let updatePayload: Record<string, unknown> = {
    ...itemData,
    ...(rawDisclosure !== undefined
      ? { seller_disclosure: rawDisclosure?.trim() || null }
      : {}),
  };
  // category_id を正規化（"" → null）— createListing と一貫性を保つ
  if ("category_id" in updatePayload) {
    updatePayload.category_id = updatePayload.category_id || null;
  }
  if (metadata !== undefined) {
    let sanitizedMeta: Record<string, unknown> | null = null;
    if (metadata) {
      const obj: Record<string, unknown> = {};
      if (metadata.domain) obj.domain = metadata.domain;
      if (metadata.experience_type) obj.experience_type = metadata.experience_type;
      if (metadata.applicable_to && metadata.applicable_to.length > 0) obj.applicable_to = metadata.applicable_to;
      if (metadata.source_type) obj.source_type = metadata.source_type;
      sanitizedMeta = Object.keys(obj).length > 0 ? obj : null;
    }
    updatePayload = { ...updatePayload, metadata: sanitizedMeta };
  }

  // 変更がある場合はバージョンスナップショットを保存
  const hasChanges = Object.keys(updatePayload).length > 0 || fullContent !== undefined;
  if (hasChanges) {
    try {
      await createVersionSnapshot({
        knowledgeItemId: id,
        changedBy: user.id,
      });
    } catch (snapshotError) {
      console.error("[listing] version snapshot failed:", snapshotError);
      return { error: t("versionSnapshotFailed") };
    }
  }

  // knowledge_items を更新
  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from("knowledge_items")
      .update(updatePayload)
      .eq("id", id)
      .eq("seller_id", user.id);

    if (error) {
      console.error("[listing] update failed:", error);
      return { error: t("listingUpdateFailed") };
    }
  }

  // full_content がある場合はコンテンツテーブルを upsert（race condition 防止）
  if (fullContent !== undefined) {
    const { error } = await supabase
      .from("knowledge_item_contents")
      .upsert(
        { knowledge_item_id: id, full_content: fullContent, file_url: null },
        { onConflict: "knowledge_item_id" },
      );
    if (error) {
      console.error("[listing] content upsert failed:", error);
      return { error: t("contentUpdateFailed") };
    }
  }

  return { error: null };
}

export async function publishListing(id: string) {
  const t = await getTranslations("Errors");

  if (!UUID_RE.test(id)) {
    return { error: t("invalidInput") };
  }

  const user = await requireAuth();
  const supabase = await createClient();

  // Validate required fields before publishing
  const { data: item, error: itemError } = await supabase
    .from("knowledge_items")
    .select("listing_type, title, description, price_sol, status")
    .eq("id", id)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (itemError) {
    console.error("[listing] publish lookup failed:", itemError);
    return { error: t("listingPublishFailed") };
  }
  if (!item) {
    return { error: t("itemNotFound") };
  }

  if (item.status !== "draft") {
    return { error: t("invalidStatus") };
  }

  if (!item.title?.trim() || !item.description?.trim()) {
    return { error: t("titleDescRequired") };
  }

  const hasPriceSol = item.price_sol != null && item.price_sol > 0;
  if (!hasPriceSol) {
    if (item.listing_type === "request") {
      return { error: t("rewardRequired") };
    }
    return { error: t("priceRequired") };
  }

  const { error } = await supabase
    .from("knowledge_items")
    .update({ status: "published" as KnowledgeStatus })
    .eq("id", id)
    .eq("seller_id", user.id);

  if (error) {
    console.error("[listing] publish failed:", error);
    return { error: t("listingPublishFailed") };
  }
  return { error: null };
}

export async function deleteListing(id: string) {
  const t = await getTranslations("Errors");

  if (!UUID_RE.test(id)) {
    return { error: t("invalidInput") };
  }

  const user = await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_items")
    .delete()
    .eq("id", id)
    .eq("seller_id", user.id);

  if (error) {
    console.error("[listing] delete failed:", error);
    return { error: t("listingDeleteFailed") };
  }
  return { error: null };
}

export async function getMyListings() {
  const t = await getTranslations("Errors");
  const user = await requireAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*, category:categories(id, name, slug)")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listing] fetch failed:", error);
    return { error: t("listingFetchFailed"), data: [] };
  }
  return { error: null, data: data ?? [] };
}

export async function fetchCategories(): Promise<
  { id: string; name: string; slug: string }[]
> {
  const categories = await getCategories();
  return categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
}
