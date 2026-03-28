import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getPersonalRecommendations } from "@/lib/recommendations/queries";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

/**
 * GET /api/v1/me/recommendations
 * Returns personal recommendations for the authenticated session user.
 * Uses Supabase session auth (not API key auth) so it can be called from the browser.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(API_ERRORS.UNAUTHORIZED);
  }

  // Ban check
  const { data: profile } = await getAdminClient()
    .from("profiles")
    .select("banned_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.banned_at) {
    return apiError(API_ERRORS.FORBIDDEN);
  }

  const recs = await getPersonalRecommendations(user.id);
  return apiSuccess(recs);
}
