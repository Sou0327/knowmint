import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

const VALID_EVENTS = [
  "purchase.completed",
  "review.created",
  "knowledge.published",
];

/**
 * B3: SSRF prevention — reject private/internal URLs
 */
function isPublicUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname;
    if (host === "localhost" || host.startsWith("127.") || host === "[::1]")
      return false;
    if (host.startsWith("10.") || host.startsWith("192.168.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.startsWith("169.254.")) return false;
    return true;
  } catch {
    return false;
  }
}

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

  // B3: Validate URL is public HTTPS
  if (!isPublicUrl(url)) {
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

  const admin = getAdminClient();

  const { data, error } = await admin
    .from("webhook_subscriptions")
    .insert({
      user_id: user.userId,
      url,
      events,
      secret,
      active: true,
    })
    .select("id, url, events, active, created_at")
    .single();

  if (error) {
    console.error("Failed to create webhook:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

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

  const { error } = await admin
    .from("webhook_subscriptions")
    .delete()
    .eq("id", webhookId)
    .eq("user_id", user.userId);

  if (error) {
    console.error("Failed to delete webhook:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess({ deleted: true });
}, { requiredPermissions: ["write"] });
