import { getAdminClient } from "@/lib/supabase/admin";
import type { AuditAction } from "@/types/database.types";

export type { AuditAction };

interface AuditLogParams {
  userId: string | null;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/** 重要フィールド: 2KB 超時も保持するキー (調査に必須) */
const IMPORTANT_METADATA_KEYS = [
  "action", "status", "error", "tx_hash", "item_id",
  "user_id", "seller_id", "buyer_id", "knowledge_item_id",
] as const;

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  const supabase = getAdminClient();
  // metadata が 2048 bytes (UTF-8) を超える場合: 重要フィールドを保持し残りを切り詰める
  const rawMeta = params.metadata ?? {};
  const metadataStr = JSON.stringify(rawMeta);
  const byteLen = Buffer.byteLength(metadataStr, "utf8");
  let metadata: Record<string, unknown>;
  if (byteLen > 2048) {
    // 重要フィールドは常に保持し、残りは切り詰め
    const important: Record<string, unknown> = {};
    for (const key of IMPORTANT_METADATA_KEYS) {
      if (key in rawMeta) important[key] = rawMeta[key];
    }
    metadata = { ...important, _truncated: true, _original_size: byteLen };
  } else {
    metadata = rawMeta;
  }

  try {
    await supabase
      .from("audit_logs")
      .insert({
        user_id: params.userId,
        action: params.action,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        metadata,
      })
      .throwOnError();
  } catch (err: unknown) {
    console.error("[audit] failed to write log:", err);
  }
}
