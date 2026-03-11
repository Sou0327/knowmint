import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const handleI18nRouting = createIntlMiddleware(routing);

const PROTECTED_ROUTES = ["/list", "/library", "/dashboard", "/profile", "/favorites", "/notifications"];

/** Canonicalize path: decode encoded separators (%2F, %5C), normalize slashes */
function canonicalizePath(raw: string): string {
  return raw
    .replace(/%2F/gi, "/")
    .replace(/%5C/gi, "/")
    .replace(/\\+/g, "/")
    .replace(/\/{2,}/g, "/");
}

export async function middleware(request: NextRequest) {
  // 0. Canonical path redirect — normalize encoded separators and duplicate slashes
  const rawPathname = request.nextUrl.pathname;
  const canonicalPath = canonicalizePath(rawPathname);
  if (canonicalPath !== rawPathname) {
    const canonicalUrl = new URL(canonicalPath + request.nextUrl.search, request.url);
    return NextResponse.redirect(canonicalUrl, 308);
  }

  // 1. API routes — CORS only, skip i18n and auth
  if (rawPathname.startsWith("/api/")) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || (
      process.env.NODE_ENV === "production" ? undefined : "*"
    );

    // Preflight
    if (request.method === "OPTIONS") {
      const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-PAYMENT",
        "Access-Control-Max-Age": "86400",
      };
      if (allowedOrigin) {
        headers["Access-Control-Allow-Origin"] = allowedOrigin;
      }
      return new NextResponse(null, { status: 204, headers });
    }
    const response = NextResponse.next();
    if (allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-PAYMENT");
    return response;
  }

  // 2. i18n routing (locale detection, rewrites, redirects)
  const response = handleI18nRouting(request);

  // 3. Decode and strip locale prefix for route matching
  // decodeURI to match next-intl's internal decoding (e.g. /%64ashboard → /dashboard)
  let decodedPathname: string;
  try {
    decodedPathname = decodeURI(rawPathname);
  } catch {
    decodedPathname = rawPathname;
  }
  const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
  const strippedPath = decodedPathname.replace(localePattern, "") || "/";

  const isProtected = PROTECTED_ROUTES.some((route) =>
    strippedPath === route || strippedPath.startsWith(route + "/")
  );
  const isAuthPage =
    strippedPath === "/login" || strippedPath === "/signup";

  // 4. Skip auth for public, non-auth routes (performance)
  if (!isProtected && !isAuthPage) {
    return response;
  }

  // 5. Supabase auth session refresh (only for protected/auth routes)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 6. Detect locale prefix for locale-aware redirects (skip for default locale under as-needed)
  const localeMatch = decodedPathname.match(localePattern);
  const matchedLocale = localeMatch?.[1];
  const localePrefix = matchedLocale && matchedLocale !== routing.defaultLocale
    ? `/${matchedLocale}`
    : "";

  // 7. Protected route → redirect to login (preserve cookies with attributes)
  if (isProtected && !user) {
    const loginUrl = new URL(`${localePrefix}/login`, request.url);
    const redirectTarget = strippedPath + request.nextUrl.search;
    loginUrl.searchParams.set("redirect", redirectTarget);
    const redirectResponse = NextResponse.redirect(loginUrl, 303);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  // 8. Auth page + logged in → redirect to home (preserve cookies with attributes)
  if (isAuthPage && user) {
    const redirectResponse = NextResponse.redirect(new URL(`${localePrefix}/`, request.url), 303);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
