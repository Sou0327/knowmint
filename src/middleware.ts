import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAllowedOrigins, resolveAllowedOrigin } from "@/lib/http/cors";

const handleI18nRouting = createIntlMiddleware(routing);

const PROTECTED_ROUTES = ["/list", "/library", "/dashboard", "/profile", "/favorites", "/notifications", "/admin"];

/** Canonicalize path: decode encoded separators (%2F, %5C), normalize slashes */
function canonicalizePath(raw: string): string {
  return raw
    .replace(/%2F/gi, "/")
    .replace(/%5C/gi, "/")
    .replace(/\\+/g, "/")
    .replace(/\/{2,}/g, "/");
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self'",
    `img-src 'self' data: https:${isDev ? " http://127.0.0.1:54321" : ""}`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.solana.com wss://*.solana.com https://api.mainnet-beta.solana.com${isDev ? " http://127.0.0.1:54321 ws://127.0.0.1:54321 http://127.0.0.1:8899 ws://127.0.0.1:8899" : ""}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-src 'self' https://www.youtube.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * `supabaseResponse` 再作成時に carry over すべき headers/cookies を引き継ぐ。
 *
 * - `x-middleware-request-cookie` は除外 — 新しい NextResponse.next() が
 *   更新済み request.cookies の fresh な値を自動生成している (古い値を
 *   上書きすると RSC が stale cookie を見てログアウト誘発)。
 * - `x-middleware-override-headers` は**マージ** — i18n (next-intl) が
 *   設定した `x-next-intl-locale` 等の override list と、新 response が
 *   生成した cookie/nonce の override list の両方を保持する必要がある。
 * - その他の `x-middleware-request-*` (locale 等) は保持 — next-intl は
 *   この経路で locale を RSC に伝播するため、除外すると defaultLocale に
 *   フォールバックして i18n が壊れる。
 */
function carryOverResponseState(prev: NextResponse, next: NextResponse) {
  // Merge x-middleware-override-headers (i18n override + next の fresh override)
  const prevOverrides = prev.headers.get("x-middleware-override-headers");
  if (prevOverrides) {
    const nextOverrides = next.headers.get("x-middleware-override-headers");
    const merged = new Set<string>();
    for (const h of (nextOverrides ?? "").split(",")) {
      const trimmed = h.trim();
      if (trimmed) merged.add(trimmed);
    }
    for (const h of prevOverrides.split(",")) {
      const trimmed = h.trim();
      if (trimmed) merged.add(trimmed);
    }
    next.headers.set("x-middleware-override-headers", Array.from(merged).join(","));
  }

  prev.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "set-cookie") return;
    if (lower === "x-middleware-override-headers") return; // already merged above
    if (lower === "x-middleware-request-cookie") return; // fresh value in `next`
    next.headers.set(key, value);
  });
  for (const cookie of prev.cookies.getAll()) {
    next.cookies.set(cookie);
  }
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
    // production で ALLOWED_ORIGINS 未設定なら throw するが、ここで catch
    // して API レスポンス自体は続行する。Origin echo が無いだけで API は
    // 通常どおり動く (CORS を必要とする cross-origin はブロックされるが、
    // 単一オリジン利用は影響なし)。deploy ミスで全 API が 500 になる事故
    // を避けるための fail-soft。
    let allowedOrigin: string | null = null;
    try {
      const allowedOrigins = getAllowedOrigins();
      const requestOrigin = request.headers.get("Origin");
      allowedOrigin = resolveAllowedOrigin(requestOrigin, allowedOrigins);
    } catch (err) {
      console.error("[cors] getAllowedOrigins failed", err);
    }

    if (request.method === "OPTIONS") {
      const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, X-PAYMENT, X-API-Key",
        "Access-Control-Expose-Headers": "WWW-Authenticate, Payment-Receipt",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      };
      if (allowedOrigin) {
        headers["Access-Control-Allow-Origin"] = allowedOrigin;
      }
      return new NextResponse(null, { status: 204, headers });
    }
    const apiResponse = NextResponse.next();
    if (allowedOrigin) {
      apiResponse.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    }
    apiResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    apiResponse.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-PAYMENT");
    apiResponse.headers.set("Access-Control-Expose-Headers", "WWW-Authenticate, Payment-Receipt");
    apiResponse.headers.set("Vary", "Origin");
    apiResponse.headers.set("Content-Security-Policy", "default-src 'none'; script-src 'none'; frame-ancestors 'none'");
    return apiResponse;
  }

  // 2. Generate nonce for page CSP
  const nonce = crypto.randomUUID();

  // 3. i18n routing (locale detection, rewrites, redirects)
  const i18nResponse = handleI18nRouting(request);

  // Redirects don't need CSP — browser will re-enter middleware on follow-up
  if (i18nResponse.status >= 300 && i18nResponse.status < 400) {
    return i18nResponse;
  }

  // 4. Decode and strip locale prefix for route matching
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

  const localeMatch = decodedPathname.match(localePattern);
  const matchedLocale = localeMatch?.[1];
  const localePrefix = matchedLocale && matchedLocale !== routing.defaultLocale
    ? `/${matchedLocale}`
    : "";

  // 5. Build request headers with x-nonce for RSC propagation.
  //    NextResponse.next({ request: { headers } }) を呼ぶと、Next.js が
  //    x-middleware-override-headers と x-middleware-request-x-nonce を
  //    自動生成し、この request 内の RSC から x-nonce を読めるようになる。
  //    `new Headers(request.headers)` は snapshot なので、setAll で cookie
  //    が更新された後は毎回 fresh な headers を組み立てる必要がある。
  const buildRequestHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    return headers;
  };

  // 6. Supabase auth — 全 route で getUser を呼ぶ (セッションリフレッシュのため)。
  //    Supabase 公式パターン: setAll 内で supabaseResponse を再作成し、
  //    更新済み request.cookies を Next.js の fresh override 経由で RSC に同期する。
  //    「Do not run code between createServerClient and supabase.auth.getUser().
  //     A simple mistake could make it very hard to debug issues with users
  //     being randomly logged out.」 (Supabase 公式 nextjs-supabase-auth ガイド)
  let supabaseResponse = NextResponse.next({
    request: { headers: buildRequestHeaders() },
  });
  carryOverResponseState(i18nResponse, supabaseResponse);
  supabaseResponse.headers.set("Content-Security-Policy", buildCsp(nonce));

  // Cloudflare Workers の subrequest / CPU 制限を圧迫しないため、
  // 認証チェックが不要な public route では auth.getUser() を呼ばずに早期 return。
  // token refresh は protected/auth route アクセス時に発生する。
  // ローカル開発 (Node.js runtime) と本番 (CF Workers) のリソース制限の違いに対応。
  if (!isProtected && !isAuthPage) {
    return supabaseResponse;
  }

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
          const prev = supabaseResponse;
          supabaseResponse = NextResponse.next({
            request: { headers: buildRequestHeaders() },
          });
          carryOverResponseState(prev, supabaseResponse);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url, 303);
    // RequestCookie オブジェクトを spread して set すると、Next.js の
    // cookies API 仕様では options (httpOnly/sameSite/secure/path/domain
    // /maxAge/expires) の伝播が暗黙的になる。Supabase auth cookie の
    // セキュリティ属性脱落を防ぐため、name/value/options を明示的に分離する。
    for (const cookie of supabaseResponse.cookies.getAll()) {
      const { name, value, ...options } = cookie;
      redirectResponse.cookies.set(name, value, options);
    }
    return redirectResponse;
  };

  // 7. Protected route → redirect to login
  if (isProtected && !user) {
    const loginUrl = new URL(`${localePrefix}/login`, request.url);
    const redirectTarget = strippedPath + request.nextUrl.search;
    loginUrl.searchParams.set("redirect", redirectTarget);
    return redirectWithCookies(loginUrl);
  }

  // 7b. Banned user check (fail-closed に対する三分岐)
  //     - profileError: transient。cookie は消さず /login へ (次のリトライで復帰)
  //     - profile 欠損: データ不整合。cookie は消さず /login へ (ban の代替認可)
  //     - banned_at: 明示的 ban。signOut して /login へ
  if (isProtected && user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("banned_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[auth] profile fetch failed", {
        userId: user.id,
        code: profileError.code,
        message: profileError.message,
      });
      return redirectWithCookies(new URL(`${localePrefix}/login`, request.url));
    }

    if (!profile) {
      console.error("[auth] profile missing", { userId: user.id });
      return redirectWithCookies(new URL(`${localePrefix}/login`, request.url));
    }

    if (profile.banned_at) {
      await supabase.auth.signOut();
      return redirectWithCookies(new URL(`${localePrefix}/login`, request.url));
    }
  }

  // 8. Auth page + logged in → redirect to home
  if (isAuthPage && user) {
    return redirectWithCookies(new URL(`${localePrefix}/`, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
