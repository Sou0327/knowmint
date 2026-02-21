"use server";

import { getAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/session";

interface VersionResult {
  data: Array<{
    id: string;
    knowledge_item_id: string;
    version_number: number;
    title: string;
    description: string;
    preview_content: string | null;
    price_sol: number | null;
    price_usdc: number | null;
    tags: string[];
    metadata: Record<string, unknown> | null;
    changed_by: string;
    change_summary: string | null;
    created_at: string;
  }>;
  totalPages: number;
  error: string | null;
}

export async function fetchVersionHistory(
  knowledgeItemId: string,
  page: number = 1,
  perPage: number = 20
): Promise<VersionResult> {
  const user = await requireAuth();
  const supabase = getAdminClient();

  // アイテム存在確認 + アクセス権チェック
  const { data: item } = await supabase
    .from("knowledge_items")
    .select("id, seller_id")
    .eq("id", knowledgeItemId)
    .single();

  if (!item) {
    return { data: [], totalPages: 0, error: "Knowledge item not found" };
  }

  const isSeller = item.seller_id === user.id;
  if (!isSeller) {
    const { data: purchase } = await supabase
      .from("transactions")
      .select("id")
      .eq("knowledge_item_id", knowledgeItemId)
      .eq("buyer_id", user.id)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();

    if (!purchase) {
      return { data: [], totalPages: 0, error: "Access denied" };
    }
  }

  // 総件数
  const { count } = await supabase
    .from("knowledge_item_versions")
    .select("id", { count: "exact", head: true })
    .eq("knowledge_item_id", knowledgeItemId);

  const total = count ?? 0;
  const safePage = Math.min(1000, Math.max(1, page));
  const safePerPage = Math.min(100, Math.max(1, perPage));
  const offset = (safePage - 1) * safePerPage;

  // バージョン一覧取得（full_content を除外）
  const { data: versions, error: fetchError } = await supabase
    .from("knowledge_item_versions")
    .select(
      "id, knowledge_item_id, version_number, title, description, preview_content, price_sol, price_usdc, tags, metadata, changed_by, change_summary, created_at"
    )
    .eq("knowledge_item_id", knowledgeItemId)
    .order("version_number", { ascending: false })
    .range(offset, offset + safePerPage - 1);

  if (fetchError) {
    return { data: [], totalPages: 0, error: "Failed to fetch version history" };
  }

  return {
    data: versions ?? [],
    totalPages: Math.ceil(total / safePerPage),
    error: null,
  };
}
