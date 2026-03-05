import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

/**
 * GET /api/v1/me/profile
 * Returns the authenticated user's profile.
 */
export const GET = withApiAuth(async (_request, user) => {
  const admin = getAdminClient();

  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, display_name, avatar_url, wallet_address, bio, user_type, trust_score, created_at, updated_at"
    )
    .eq("id", user.userId)
    .single();

  if (error || !profile) {
    console.error("[me/profile] fetch failed:", { userId: user.userId, error });
    return apiError(API_ERRORS.NOT_FOUND, "Profile not found");
  }

  return apiSuccess(profile);
}, { requiredPermissions: ["read"] });
