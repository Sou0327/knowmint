import { createClient } from "@/lib/supabase/server";
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

  const recs = await getPersonalRecommendations(user.id);
  return apiSuccess(recs);
}
