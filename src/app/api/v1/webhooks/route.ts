import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { encryptSecret } from "@/lib/webhooks/crypto";
import { checkPublicUrl } from "@/lib/webhooks/ssrf";
import { logAuditEvent } from "@/lib/audit/log";

const VALID_EVENTS = [
  "purchase.completed",
  "review.created",
  "listing.published",
];

/**
 * GET /api/v1/webhooks
 * List webhook subscriptions for the authenticated user.
 */
export const GET = withApiAuth(async (_request, user) => {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from("webhook_subscriptions")
    .select("id, url, events, active, created_at, updated_at")
    .eq("user_id", user.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch webhooks:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess(data ?? []);
}, { requiredPermissions: ["read"] });

/**
 * POST /api/v1/webhooks
 * Register a new webhook subscription.
 * Body: { url: string, events: string[] }
 */
export const POST = withApiAuth(async (request, user) => {
  let body: { url?: string; events?: string[] };
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const { url, events } = body;

  if (!url || typeof url !== "string") {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Field 'url' must be a valid HTTPS URL"
    );
  }

  if (url.length > 2048) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'url' must be 2048 characters or fewer");
  }

  // B3: Pre-filter — reject clearly invalid URLs early.
  // NOTE: This registration-time check is NOT the primary SSRF protection.
  // The actual protection is IP pinning in dispatchWebhook (dispatch.ts),
  // which re-validates the URL and pins the resolved IP at delivery time.
  // Do NOT remove the checkPublicUrl call in dispatch.ts.
  const ssrfCheck = await checkPublicUrl(url);
  if (!ssrfCheck.safe) {
    if (ssrfCheck.reason === "dns_notfound") {
      // ユーザー起因のDNS解決失敗（NXDOMAIN/typo）→ 400
      return apiError(API_ERRORS.BAD_REQUEST, "Failed to resolve URL hostname; please check the URL");
    }
    if (ssrfCheck.reason === "dns_error") {
      // 一時的なDNS障害 → 500（再試行してください）
      return apiError(API_ERRORS.INTERNAL_ERROR, "Failed to resolve URL hostname; please try again");
    }
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Field 'url' must be a public HTTPS URL (no private/internal addresses)"
    );
  }

  if (!Array.isArray(events) || events.length === 0) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      `Field 'events' must be a non-empty array. Valid events: ${VALID_EVENTS.join(", ")}`
    );
  }

  if (events.length > 10) {
    return apiError(API_ERRORS.BAD_REQUEST, "Maximum 10 events per subscription");
  }

  if (events.some((e) => typeof e !== "string")) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'events' must be an array of strings");
  }

  const invalidEvents = events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      `Invalid events: ${invalidEvents.join(", ")}. Valid: ${VALID_EVENTS.join(", ")}`
    );
  }

  // Generate signing secret
  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const secret =
    "whsec_" +
    Array.from(secretBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // SHA-256 hash for verification; AES-GCM encrypted copy for HMAC signing.
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(secret) as BufferSource);
  const secretHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Encrypt the secret for HMAC signing during webhook dispatch.
  // Falls back to null if WEBHOOK_SIGNING_KEY is not configured.
  let secretEncrypted: string | null = null;
  try {
    secretEncrypted = encryptSecret(secret);
  } catch (err) {
    console.warn("WEBHOOK_SIGNING_KEY not configured; webhook signing disabled:", err);
  }

  const admin = getAdminClient();

  const { data, error } = await admin
    .from("webhook_subscriptions")
    .insert({
      user_id: user.userId,
      url,
      events,
      secret_hash: secretHash,
      secret_encrypted: secretEncrypted,
      active: true,
    })
    .select("id, url, events, active, created_at")
    .single();

  if (error) {
    console.error("Failed to create webhook:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  // URL のクエリパラメータ・認証情報を除去してから記録する
  let sanitizedUrl = url;
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    parsed.username = "";
    parsed.password = "";
    sanitizedUrl = parsed.toString();
  } catch { /* invalid URL はそのまま保存 */ }

  logAuditEvent({
    userId: user.userId,
    action: "webhook.created",
    resourceType: "webhook",
    resourceId: data.id,
    metadata: { url: sanitizedUrl, events },
  });

  return apiSuccess({ ...data, secret }, 201);
}, { requiredPermissions: ["write"] });

/**
 * DELETE /api/v1/webhooks
 * Remove a webhook subscription.
 * Body or search params: { webhook_id: string }
 */
export const DELETE = withApiAuth(async (request, user) => {
  let webhookId: string | null = null;
  try {
    const body = await request.json();
    webhookId = body.webhook_id || null;
  } catch {
    const url = new URL(request.url);
    webhookId = url.searchParams.get("webhook_id");
  }

  if (!webhookId) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Field 'webhook_id' is required"
    );
  }

  const admin = getAdminClient();

  const { data: deleted, error } = await admin
    .from("webhook_subscriptions")
    .delete()
    .eq("id", webhookId)
    .eq("user_id", user.userId)
    .select("id");

  if (error) {
    console.error("Failed to delete webhook:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  if (!deleted || deleted.length === 0) {
    return apiError(API_ERRORS.NOT_FOUND, "Webhook not found");
  }

  logAuditEvent({
    userId: user.userId,
    action: "webhook.deleted",
    resourceType: "webhook",
    resourceId: webhookId,
    metadata: {},
  });

  return apiSuccess({ deleted: true });
}, { requiredPermissions: ["write"] });
