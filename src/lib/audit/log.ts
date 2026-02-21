import { getAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  | "key.created"
  | "key.deleted"
  | "purchase.completed"
  | "listing.published"
  | "webhook.created"
  | "webhook.deleted";

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
  supabase
    .from("audit_logs")
    .insert({
      user_id: params.userId,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      metadata: params.metadata ?? {},
    })
    .throwOnError()
    .then(
      () => {},
      (err: unknown) => {
        console.error("[audit] failed to write log:", err);
      }
    );
}
