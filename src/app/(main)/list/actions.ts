"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { createVersionSnapshot } from "@/lib/knowledge/versions";
import type { KnowledgeStatus } from "@/types/database.types";
import {
  buildRequestFullContent,
  buildRequestPreviewContent,
  normalizeRequestContent,
  type RequestContentInput,
} from "@/lib/knowledge/requestContent";

const requestContentSchema = z.object({
  needed_info: z
    .string()
    .trim()
    .min(1, "必要な情報は必須です")
    .max(5000, "必要な情報は5000文字以内"),
  background: z
    .string()
    .trim()
    .min(1, "用途・背景は必須です")
    .max(5000, "用途・背景は5000文字以内"),
  delivery_conditions: z
    .string()
    .trim()
    .max(5000, "納品条件は5000文字以内")
    .default(""),
  notes: z
    .string()
    .trim()
    .max(5000, "補足は5000文字以内")
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
  title: z.string().min(1, "タイトルは必須です").max(200, "タイトルは200文字以内"),
  description: z.string().min(1, "説明は必須です").max(5000, "説明は5000文字以内"),
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
        message: "募集内容を入力してください",
      });
    }
  });

const updateSchema = listingSchemaBase.partial();

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
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "入力が不正です", id: null };
  }

  const { full_content, request_content, metadata, seller_disclosure, ...itemData } = parsed.data;
  const user = await requireAuth();
  const supabase = await createClient();
  let previewContent = itemData.preview_content;
  let fullContent = full_content;

  // metadata から空文字フィールドを除去してサニタイズ
  const sanitizedMetadata: Record<string, unknown> = {};
  if (metadata) {
    if (metadata.domain) sanitizedMetadata.domain = metadata.domain;
    if (metadata.experience_type) sanitizedMetadata.experience_type = metadata.experience_type;
    if (metadata.applicable_to && metadata.applicable_to.length > 0) sanitizedMetadata.applicable_to = metadata.applicable_to;
    if (metadata.source_type) sanitizedMetadata.source_type = metadata.source_type;
  }

  if (itemData.listing_type === "request") {
    if (!request_content) {
      return { error: "募集内容を入力してください", id: null };
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
      seller_disclosure: seller_disclosure?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message, id: null };
  }

  // コンテンツ分離テーブルに full_content を挿入
  if (fullContent) {
    const { error: contentError } = await supabase
      .from("knowledge_item_contents")
      .insert({
      knowledge_item_id: data.id,
      full_content: fullContent,
    });

    if (contentError) {
      await supabase.from("knowledge_items").delete().eq("id", data.id);
      return {
        error: contentError.message || "コンテンツ保存に失敗しました",
        id: null,
      };
    }
  }

  return { error: null, id: data.id };
}

export async function updateListing(id: string, input: Record<string, unknown>) {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "入力が不正です" };
  }

  const { full_content, request_content, metadata, seller_disclosure: rawDisclosure, ...itemData } = parsed.data;
  const user = await requireAuth();
  const supabase = await createClient();
  let fullContent = full_content;

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
  if (metadata !== undefined) {
    const sanitizedMetadata: Record<string, unknown> = {};
    if (metadata) {
      if (metadata.domain) sanitizedMetadata.domain = metadata.domain;
      if (metadata.experience_type) sanitizedMetadata.experience_type = metadata.experience_type;
      if (metadata.applicable_to && metadata.applicable_to.length > 0) sanitizedMetadata.applicable_to = metadata.applicable_to;
      if (metadata.source_type) sanitizedMetadata.source_type = metadata.source_type;
    }
    updatePayload = { ...updatePayload, metadata: sanitizedMetadata };
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
      console.error("Version snapshot failed:", snapshotError);
      return { error: "バージョンスナップショットの保存に失敗しました" };
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
      return { error: error.message };
    }
  }

  // full_content がある場合はコンテンツテーブルを更新
  if (fullContent !== undefined) {
    const { data: existing } = await supabase
      .from("knowledge_item_contents")
      .select("id")
      .eq("knowledge_item_id", id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("knowledge_item_contents")
        .update({ full_content: fullContent })
        .eq("knowledge_item_id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("knowledge_item_contents").insert({
        knowledge_item_id: id,
        full_content: fullContent,
      });
      if (error) return { error: error.message };
    }
  }

  return { error: null };
}

export async function publishListing(id: string) {
  const user = await requireAuth();
  const supabase = await createClient();

  // Validate required fields before publishing
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("listing_type, title, description, price_sol, price_usdc")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (!item) {
    return { error: "アイテムが見つかりません" };
  }

  if (!item.title || !item.description) {
    return { error: "タイトルと説明は必須です" };
  }

  if (!item.price_sol && !item.price_usdc) {
    if (item.listing_type === "request") {
      return { error: "希望報酬を設定してください" };
    }
    return { error: "価格を設定してください" };
  }

  const { error } = await supabase
    .from("knowledge_items")
    .update({ status: "published" as KnowledgeStatus })
    .eq("id", id)
    .eq("seller_id", user.id);

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function deleteListing(id: string) {
  const user = await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_items")
    .delete()
    .eq("id", id)
    .eq("seller_id", user.id);

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function getMyListings() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*, category:categories(id, name, slug)")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, data: [] };
  }
  return { error: null, data: data ?? [] };
}
