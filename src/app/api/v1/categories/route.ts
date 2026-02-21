import { getAdminClient } from "@/lib/supabase/admin";
import { withApiAuth } from "@/lib/api/middleware";
import { apiSuccess, apiError, API_ERRORS } from "@/lib/api/response";

/**
 * GET /api/v1/categories
 * List all categories.
 */
export const GET = withApiAuth(async () => {
  const admin = getAdminClient();

  const { data: categories, error } = await admin
    .from("categories")
    .select("id, name, slug, icon")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch categories:", error);
    return apiError(API_ERRORS.INTERNAL_ERROR);
  }

  return apiSuccess(categories || []);
}, { requiredPermissions: ["read"] });
