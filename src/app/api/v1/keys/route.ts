import { after } from "next/server";
import { authenticateApiKey, generateApiKey } from "@/lib/api/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { ALLOWED_PERMISSIONS } from "@/lib/api/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { UUID_RE, validateExpiresAt } from "@/lib/api/validation";
import { checkPreAuthRateLimit } from "@/lib/api/rate-limit";
import { sendApiKeyEventEmail } from "@/lib/email/key-events";

interface ResolvedAuth {
  userId: string;
  currentKeyId: string | null;
  email?: string;
}

async function resolveKeysAuth(request: Request): Promise<ResolvedAuth | Response> {
  let userId: string;
  let currentKeyId: string | null = null;
  let email: string | undefined;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const apiUser = await authenticateApiKey(request);
    if (!apiUser) {
      return apiError(API_ERRORS.UNAUTHORIZED);
    }
    if (!apiUser.permissions.includes("admin")) {
      return apiError(API_ERRORS.FORBIDDEN);
    }
    userId = apiUser.userId;
    currentKeyId = apiUser.keyId;
  } else {
    const sessionSupabase = await createSessionClient();
    const {
      data: { user },
    } = await sessionSupabase.auth.getUser();

    if (!user) {
      return apiError(API_ERRORS.UNAUTHORIZED);
    }
    userId = user.id;
    email = user.email;
  }

  // Ban check (fail-closed)
  const admin = getAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("banned_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile || profile.banned_at) {
    return apiError(API_ERRORS.FORBIDDEN);
  }

  return { userId, currentKeyId, email };
}

/**
 * GET /api/v1/keys
 * List all API keys for the authenticated user (excluding key_hash).
 */
export const GET = async (request: Request) => {
  try {
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
      console.error("[keys] Failed to fetch API keys:", error);
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }

    return apiSuccess(keys || []);
  } catch (error) {
    console.error("[keys] Unhandled error in GET:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
};

/**
 * POST /api/v1/keys
 * Create a new API key for the authenticated user.
 * Body: { name: string, permissions?: string[], expires_at?: string }
 */
export const POST = async (request: Request) => {
  try {
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

    // admin パーミッションは API 経由では付与不可 (DB 直接作成のみ)
    if (permissions.includes("admin")) {
      return apiError(
        API_ERRORS.FORBIDDEN,
        "Admin permission cannot be granted via API"
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
        last_used_at: null,
        expires_at: normalizedExpiresAt,
      })
      .select("id, name, permissions, created_at, expires_at")
      .single();

    if (error) {
      console.error("[keys] Failed to create API key:", error);
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }

    after(() => logAuditEvent({
      userId: auth.userId,
      action: "key.created",
      resourceType: "api_key",
      resourceId: newKey.id,
      metadata: { name: newKey.name, permissions: newKey.permissions },
    }));

    // APIキー作成メール送信 (fire-and-forget)
    // セッション認証時は auth.email が既に取得済みのため getUserById を省略
    sendApiKeyEventEmail(
      admin,
      { userId: auth.userId, email: auth.email },
      {
        kind: "created",
        keyName: newKey.name,
        permissions: newKey.permissions as string[],
      },
    );

    return apiSuccess({
      id: newKey.id,
      name: newKey.name,
      key: raw,
      permissions: newKey.permissions,
      created_at: newKey.created_at,
      expires_at: newKey.expires_at,
    }, 201);
  } catch (error) {
    console.error("[keys] Unhandled error in POST:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
};

/**
 * DELETE /api/v1/keys
 * Delete an API key owned by the authenticated user.
 * Body or URL params: { key_id: string }
 */
export const DELETE = async (request: Request) => {
  try {
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
      console.error("[keys] Failed to delete API key:", error);
      return apiError(API_ERRORS.INTERNAL_ERROR);
    }

    if (!deleted || deleted.length === 0) {
      return apiError(API_ERRORS.NOT_FOUND, "API key not found");
    }

    after(() => logAuditEvent({
      userId: auth.userId,
      action: "key.deleted",
      resourceType: "api_key",
      resourceId: keyId,
      metadata: {},
    }));

    // APIキー削除メール送信 (fire-and-forget)
    const deletedKeyName = (deleted[0] as { name?: string } | undefined)?.name ?? keyId;
    sendApiKeyEventEmail(
      admin,
      { userId: auth.userId, email: auth.email },
      { kind: "deleted", keyName: deletedKeyName },
    );

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("[keys] Unhandled error in DELETE:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }
};
