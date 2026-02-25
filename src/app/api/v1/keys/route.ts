import { authenticateApiKey, generateApiKey } from "@/lib/api/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { ALLOWED_PERMISSIONS } from "@/lib/api/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { validateExpiresAt } from "@/lib/api/validation";
import { checkPreAuthRateLimit } from "@/lib/api/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { apiKeyCreatedEmailHtml, apiKeyDeletedEmailHtml } from "@/lib/email/templates";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ResolvedAuth {
  userId: string;
  currentKeyId: string | null;
  email?: string;
}

async function resolveKeysAuth(request: Request): Promise<ResolvedAuth | Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const apiUser = await authenticateApiKey(request);
    if (!apiUser) {
      return apiError(API_ERRORS.UNAUTHORIZED);
    }
    if (!apiUser.permissions.includes("admin")) {
      return apiError(API_ERRORS.FORBIDDEN);
    }
    return { userId: apiUser.userId, currentKeyId: apiUser.keyId };
  }

  const sessionSupabase = await createSessionClient();
  const {
    data: { user },
  } = await sessionSupabase.auth.getUser();

  if (!user) {
    return apiError(API_ERRORS.UNAUTHORIZED);
  }

  return { userId: user.id, currentKeyId: null, email: user.email };
}

/**
 * GET /api/v1/keys
 * List all API keys for the authenticated user (excluding key_hash).
 */
export const GET = async (request: Request) => {
  const preAuth = await checkPreAuthRateLimit(request);
  if (!preAuth.allowed) return apiError(API_ERRORS.RATE_LIMITED);

  const auth = await resolveKeysAuth(request);
  if (auth instanceof Response) return auth;

  const admin = getAdminClient();

  const { data: keys, error } = await admin
    .from("api_keys")
    .select("id, name, permissions, last_used_at, created_at, expires_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch API keys:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess(keys || []);
};

/**
 * POST /api/v1/keys
 * Create a new API key for the authenticated user.
 * Body: { name: string, permissions?: string[], expires_at?: string }
 */
export const POST = async (request: Request) => {
  const preAuth = await checkPreAuthRateLimit(request);
  if (!preAuth.allowed) return apiError(API_ERRORS.RATE_LIMITED);

  const auth = await resolveKeysAuth(request);
  if (auth instanceof Response) return auth;

  let body: { name?: string; permissions?: string[]; expires_at?: string };
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERRORS.BAD_REQUEST, "Invalid JSON body");
  }

  const { name, permissions = ["read"], expires_at } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Field 'name' is required and must be non-empty"
    );
  }

  if (name.trim().length > 255) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'name' must be 255 characters or fewer");
  }

  if (
    !Array.isArray(permissions) ||
    permissions.some((p) => typeof p !== "string")
  ) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Field 'permissions' must be an array of strings"
    );
  }

  const invalid = permissions.filter(
    (p) => !(ALLOWED_PERMISSIONS as readonly string[]).includes(p)
  );
  if (invalid.length > 0) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      `Invalid permissions: ${invalid.join(", ")}. Allowed: ${ALLOWED_PERMISSIONS.join(", ")}`
    );
  }

  // セッション認証ユーザーは admin パーミッションを付与できない
  // (既存 admin キー経由でのみ admin キー作成可能)
  if (!auth.currentKeyId && permissions.includes("admin")) {
    return apiError(
      API_ERRORS.FORBIDDEN,
      "Admin permission can only be granted via an existing admin API key"
    );
  }

  const expiresResult = validateExpiresAt(expires_at);
  if (!expiresResult.valid) {
    return apiError(API_ERRORS.BAD_REQUEST, expiresResult.reason);
  }

  // 日付のみ形式（YYYY-MM-DD）は TIMESTAMPTZ に 00:00:00 で保存されるため
  // 当日終端に正規化してから保存する（検証ロジックの compareDate と整合させる）
  const normalizedExpiresAt =
    expires_at && !expires_at.includes("T")
      ? `${expires_at}T23:59:59.999Z`
      : expires_at || null;

  const { raw, hash } = await generateApiKey();
  const admin = getAdminClient();

  const { data: newKey, error } = await admin
    .from("api_keys")
    .insert({
      user_id: auth.userId,
      key_hash: hash,
      name: name.trim(),
      permissions,
      expires_at: normalizedExpiresAt,
    })
    .select("id, name, permissions, created_at, expires_at")
    .single();

  if (error) {
    console.error("Failed to create API key:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  logAuditEvent({
    userId: auth.userId,
    action: "key.created",
    resourceType: "api_key",
    resourceId: newKey.id,
    metadata: { name: newKey.name, permissions: newKey.permissions },
  });

  // APIキー作成メール送信 (fire-and-forget)
  // セッション認証時は auth.email が既に取得済みのため getUserById を省略
  const sendCreatedEmail = (email: string) => {
    const content = apiKeyCreatedEmailHtml({ keyName: newKey.name, permissions: newKey.permissions as string[] });
    sendEmail({ to: email, ...content }).catch(() => {});
  };
  if (auth.email) {
    sendCreatedEmail(auth.email);
  } else {
    admin.auth.admin.getUserById(auth.userId).then(
      ({ data: authData }) => { if (authData?.user?.email) sendCreatedEmail(authData.user.email); },
      () => {}
    );
  }

  return apiSuccess({
    id: newKey.id,
    name: newKey.name,
    key: raw,
    permissions: newKey.permissions,
    created_at: newKey.created_at,
    expires_at: newKey.expires_at,
  });
};

/**
 * DELETE /api/v1/keys
 * Delete an API key owned by the authenticated user.
 * Body or URL params: { key_id: string }
 */
export const DELETE = async (request: Request) => {
  const preAuth = await checkPreAuthRateLimit(request);
  if (!preAuth.allowed) return apiError(API_ERRORS.RATE_LIMITED);

  const auth = await resolveKeysAuth(request);
  if (auth instanceof Response) return auth;

  let keyId: string | null = null;

  try {
    const body = await request.json();
    keyId = body.key_id || null;
  } catch {
    const url = new URL(request.url);
    keyId = url.searchParams.get("key_id");
  }

  if (!keyId || typeof keyId !== "string") {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'key_id' is required");
  }

  if (!UUID_RE.test(keyId)) {
    return apiError(API_ERRORS.BAD_REQUEST, "Field 'key_id' must be a valid UUID");
  }

  if (auth.currentKeyId && keyId === auth.currentKeyId) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Cannot delete the API key currently in use"
    );
  }

  const admin = getAdminClient();

  const { data: deleted, error } = await admin
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", auth.userId)
    .select("id, name");

  if (error) {
    console.error("Failed to delete API key:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  if (!deleted || deleted.length === 0) {
    return apiError(API_ERRORS.NOT_FOUND, "API key not found");
  }

  logAuditEvent({
    userId: auth.userId,
    action: "key.deleted",
    resourceType: "api_key",
    resourceId: keyId,
    metadata: {},
  });

  // APIキー削除メール送信 (fire-and-forget)
  const deletedKeyName = (deleted[0] as { name?: string } | undefined)?.name ?? keyId;
  const sendDeletedEmail = (email: string) => {
    const content = apiKeyDeletedEmailHtml({ keyName: deletedKeyName });
    sendEmail({ to: email, ...content }).catch(() => {});
  };
  if (auth.email) {
    sendDeletedEmail(auth.email);
  } else {
    admin.auth.admin.getUserById(auth.userId).then(
      ({ data: authData }) => { if (authData?.user?.email) sendDeletedEmail(authData.user.email); },
      () => {}
    );
  }

  return apiSuccess({ deleted: true });
};
