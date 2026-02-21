import { authenticateApiKey, generateApiKey } from "@/lib/api/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";
import { createClient as createSessionClient } from "@/lib/supabase/server";

interface ResolvedAuth {
  userId: string;
  currentKeyId: string | null;
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

  return { userId: user.id, currentKeyId: null };
}

/**
 * GET /api/v1/keys
 * List all API keys for the authenticated user (excluding key_hash).
 */
export const GET = async (request: Request) => {
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

  if (
    !Array.isArray(permissions) ||
    permissions.some((p) => typeof p !== "string")
  ) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Field 'permissions' must be an array of strings"
    );
  }

  if (expires_at !== undefined && expires_at !== null) {
    const expiresDate = new Date(expires_at);
    if (isNaN(expiresDate.getTime())) {
      return apiError(
        API_ERRORS.BAD_REQUEST,
        "Field 'expires_at' must be a valid ISO date"
      );
    }
  }

  const { raw, hash } = await generateApiKey();
  const admin = getAdminClient();

  const { data: newKey, error } = await admin
    .from("api_keys")
    .insert({
      user_id: auth.userId,
      key_hash: hash,
      name: name.trim(),
      permissions,
      expires_at: expires_at || null,
    })
    .select("id, name, permissions, created_at, expires_at")
    .single();

  if (error) {
    console.error("Failed to create API key:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
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

  if (auth.currentKeyId && keyId === auth.currentKeyId) {
    return apiError(
      API_ERRORS.BAD_REQUEST,
      "Cannot delete the API key currently in use"
    );
  }

  const admin = getAdminClient();

  const { error } = await admin
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", auth.userId);

  if (error) {
    console.error("Failed to delete API key:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess({ deleted: true });
};
