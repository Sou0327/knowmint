import { NextResponse } from "next/server";

export interface ApiErrorDef {
  code: string;
  message: string;
  status: number;
}

export const API_ERRORS = {
  UNAUTHORIZED: { code: "unauthorized", message: "Invalid or missing API key", status: 401 },
  FORBIDDEN: { code: "forbidden", message: "Insufficient permissions", status: 403 },
  NOT_FOUND: { code: "not_found", message: "Resource not found", status: 404 },
  RATE_LIMITED: { code: "rate_limited", message: "Rate limit exceeded. Retry after the specified time.", status: 429 },
  BAD_REQUEST: { code: "bad_request", message: "Invalid request", status: 400 },
  CONFLICT: { code: "conflict", message: "Resource already exists", status: 409 },
  INTERNAL_ERROR: { code: "internal_error", message: "Internal server error", status: 500 },
} as const;

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export function apiSuccess<T>(data: T, status = 200) {
  return withSecurityHeaders(
    NextResponse.json({ success: true, data }, { status })
  );
}

export function apiError(error: ApiErrorDef, details?: string) {
  if (details) {
    console.error(`[api] ${error.code}: ${details}`);
  }
  return withSecurityHeaders(
    NextResponse.json(
      { success: false, error: { code: error.code, message: details || error.message } },
      { status: error.status }
    )
  );
}

export function apiPaginated<T>(data: T[], total: number, page: number, perPage: number) {
  const safePerPage = Math.max(1, perPage);
  return withSecurityHeaders(
    NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        per_page: safePerPage,
        total_pages: Math.ceil(total / safePerPage),
      },
    })
  );
}

export function withRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  resetMs: number
): NextResponse {
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetMs / 1000)));
  return response;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string };
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}
