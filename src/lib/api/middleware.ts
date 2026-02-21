import { authenticateApiKey, AuthenticatedUser } from "@/lib/api/auth";
import { checkRateLimit, checkPreAuthRateLimit } from "@/lib/api/rate-limit";
import { apiError, withRateLimitHeaders, API_ERRORS } from "@/lib/api/response";

type RouteContext = { params: Promise<Record<string, string>> };

type ApiHandler = (
  req: Request,
  user: AuthenticatedUser,
  rateLimit: { remaining: number; resetMs: number },
  context?: RouteContext
) => Promise<Response>;

interface WithApiAuthOptions {
  requiredPermissions?: string[];
}

export function withApiAuth(handler: ApiHandler, options?: WithApiAuthOptions) {
  return async (request: Request, context?: RouteContext): Promise<Response> => {
    // Pre-auth rate limit (IP-based)
    const preAuth = checkPreAuthRateLimit(request);
    if (!preAuth.allowed) {
      return withRateLimitHeaders(
        apiError(API_ERRORS.RATE_LIMITED),
        preAuth.remaining,
        preAuth.resetMs
      );
    }

    // Authentication
    const user = await authenticateApiKey(request);
    if (!user) {
      return apiError(API_ERRORS.UNAUTHORIZED);
    }

    // Permission check
    if (options?.requiredPermissions) {
      const hasAll = options.requiredPermissions.every((p) =>
        user.permissions.includes(p)
      );
      if (!hasAll) {
        return apiError(API_ERRORS.FORBIDDEN);
      }
    }

    // Post-auth rate limit (key-based)
    const rateLimit = checkRateLimit(user.keyId);
    if (!rateLimit.allowed) {
      return withRateLimitHeaders(
        apiError(API_ERRORS.RATE_LIMITED),
        rateLimit.remaining,
        rateLimit.resetMs
      );
    }

    try {
      const response = await handler(request, user, rateLimit, context);
      // Add rate limit headers
      response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
      response.headers.set(
        "X-RateLimit-Reset",
        String(Math.ceil(rateLimit.resetMs / 1000))
      );
      return response;
    } catch (error) {
      console.error("Unhandled error in API handler:", error);
      return withRateLimitHeaders(
        apiError(API_ERRORS.INTERNAL_ERROR),
        rateLimit.remaining,
        rateLimit.resetMs
      );
    }
  };
}
