import { getAdminClient } from "@/lib/supabase/admin";

/**
 * バージョン履歴を取得（full_content を除外）
 */
export async function getVersionHistory(knowledgeItemId: string, limit = 20) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("knowledge_item_versions")
    .select(
      "id, knowledge_item_id, version_number, title, description, preview_content, price_sol, price_usdc, tags, metadata, changed_by, change_summary, created_at"
    )
    .eq("knowledge_item_id", knowledgeItemId)
    .order("version_number", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}

/**
 * 特定バージョンを取得（full_content を除外）。
 * 呼び出し側で売り手 or 購入者の認可を済ませてから使用すること。
 */
export async function getVersionById(
  knowledgeItemId: string,
  versionNumber: number
) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("knowledge_item_versions")
    .select(
      "id, knowledge_item_id, version_number, title, description, preview_content, price_sol, price_usdc, tags, metadata, changed_by, change_summary, created_at"
    )
    .eq("knowledge_item_id", knowledgeItemId)
    .eq("version_number", versionNumber)
    .single();

  if (error) return null;
  return data;
}

/**
 * 現在のアイテム状態をバージョンスナップショットとして保存する。
 * アイテムの更新前に呼び出すことで「変更前の状態」を記録する。
 * 採番 + INSERT を単一 RPC (advisory lock 内) で原子的に実行し、競合を防止する。
 *
 * @returns 作成されたバージョン or エラー時に例外をスロー
 */
export async function createVersionSnapshot(params: {
  knowledgeItemId: string;
  changedBy: string;
  changeSummary?: string;
}): Promise<{ id: string; version_number: number }> {
  const supabase = getAdminClient();

  // 現在のアイテム情報を取得
  const { data: item } = await supabase
    .from("knowledge_items")
    .select(
      "id, title, description, preview_content, price_sol, price_usdc, tags, metadata"
    )
    .eq("id", params.knowledgeItemId)
    .single();

  if (!item) {
    throw new Error("Knowledge item not found for version snapshot");
  }

  // 現在のコンテンツを取得
  const { data: content, error: contentError } = await supabase
    .from("knowledge_item_contents")
    .select("full_content")
    .eq("knowledge_item_id", params.knowledgeItemId)
    .maybeSingle();

  if (contentError) {
    throw new Error(`Failed to fetch content for version snapshot: ${contentError.message}`);
  }

  // 採番 + INSERT を単一 RPC で原子的に実行
  const { data: version, error } = await supabase.rpc(
    "create_version_snapshot",
    {
      p_knowledge_item_id: params.knowledgeItemId,
      p_title: item.title,
      p_description: item.description,
      p_preview_content: item.preview_content,
      p_price_sol: item.price_sol,
      p_price_usdc: item.price_usdc,
      p_tags: item.tags,
      p_metadata: item.metadata,
      p_full_content: content?.full_content ?? null,
      p_changed_by: params.changedBy,
      p_change_summary: params.changeSummary ?? null,
    }
  );

  if (error) {
    throw new Error(`Failed to create version snapshot: ${error.message}`);
  }

  return version;
}
