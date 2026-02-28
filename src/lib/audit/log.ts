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

// fire-and-forget — reject handler 必須 (CLAUDE.md ルール)
export function logAuditEvent(params: AuditLogParams): void {
  const supabase = getAdminClient();
  // throwOnError() で DB エラーを Promise reject に変換し、
  // reject handler で確実に捕捉できるようにする。
  // metadata が 2048 bytes (UTF-8) を超える場合は切り詰める
  const metadataStr = JSON.stringify(params.metadata ?? {});
  const byteLen = Buffer.byteLength(metadataStr, "utf8");
  const metadata =
    byteLen > 2048
      ? { _truncated: true, _original_size: byteLen }
      : (params.metadata ?? {});

  supabase
    .from("audit_logs")
    .insert({
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType ?? null,
      resource_id: params.resourceId ?? null,
      metadata,
    })
    .throwOnError()
    .then(
      () => {},
      (err: unknown) => {
        console.error("[audit] failed to write log:", err);
      }
    );
}
