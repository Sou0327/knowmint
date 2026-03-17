import type { MetadataRoute } from "next";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

const BASE_URL = "https://knowmint.shop";

// Deploy date fallback — overridden by DB-derived dates in fetchSitemap()
const DEPLOY_FALLBACK = new Date("2026-03-17");

const STATIC_PATHS = [
  { path: "/", changeFrequency: "daily" as const, priority: 1.0 },
  { path: "/search", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/rankings", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/developers", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/security", changeFrequency: "monthly" as const, priority: 0.5 },
  ...["/terms", "/privacy", "/legal", "/contact"].map((p) => ({
    path: p,
    changeFrequency: "monthly" as const,
    priority: 0.3,
  })),
];

function withAlternates(path: string) {
  const normalizedPath = path === "/" ? "" : path;
  return {
    languages: {
      en: `${BASE_URL}${normalizedPath || "/"}`,
      ja: `${BASE_URL}/ja${normalizedPath || "/"}`,
    },
  };
}

const MAX_SITEMAP_URLS = 50000;

interface SitemapCache {
  data: MetadataRoute.Sitemap;
  createdAt: number;
  expiresAt: number;
}

const CACHE_TTL_MS = 3_600_000; // 1 hour
const ERROR_RETRY_MS = 60_000; // 1 min backoff on DB failure
const MAX_STALE_MS = 86_400_000; // 24 hours max stale

declare global {
  var __sitemapCache: SitemapCache | undefined;
  var __sitemapInflight: Promise<MetadataRoute.Sitemap> | undefined;
}

async function fetchSitemap(): Promise<MetadataRoute.Sitemap> {
  let categoryEntries: MetadataRoute.Sitemap = [];
  let knowledgeEntries: MetadataRoute.Sitemap = [];
  let querySucceeded = true;
  // Derive lastmod from the most recent knowledge_items.updated_at (set after DB queries)
  let siteLastModified: Date = DEPLOY_FALLBACK;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("[sitemap] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    const staticCount = STATIC_PATHS.length;
    const categoryBudget = MAX_SITEMAP_URLS - staticCount;

    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("slug")
      .order("slug")
      .limit(categoryBudget);

    if (catError) {
      console.error("[sitemap] categories query failed:", catError.message);
      querySucceeded = false;
    }

    // Skip knowledge query if categories already failed
    const knowledgeLimit = Math.max(0, MAX_SITEMAP_URLS - staticCount - (categories?.length ?? 0));

    if (knowledgeLimit > 0 && querySucceeded) {
      const { data, error } = await supabase
        .from("knowledge_items")
        .select("id, updated_at")
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(knowledgeLimit);

      if (error) {
        console.error("[sitemap] DB query failed:", error.message);
        querySucceeded = false;
      } else {
        // Use the most recent item's updated_at as the site-wide lastmod
        if (data.length > 0 && data[0].updated_at) {
          siteLastModified = new Date(data[0].updated_at);
        }
        knowledgeEntries = data.map((item) => {
          const path = `/knowledge/${item.id}`;
          return {
            url: `${BASE_URL}${path}`,
            lastModified: item.updated_at ? new Date(item.updated_at) : siteLastModified,
            changeFrequency: "weekly" as const,
            priority: 0.8,
            alternates: withAlternates(path),
          };
        });
      }
    }

    if (querySucceeded && categories) {
      categoryEntries = categories.map((cat) => {
        const path = `/category/${cat.slug}`;
        return {
          url: `${BASE_URL}${path}`,
          lastModified: siteLastModified,
          changeFrequency: "daily" as const,
          priority: 0.7,
          alternates: withAlternates(path),
        };
      });
    }
  } catch (err) {
    console.error("[sitemap] Failed to fetch sitemap data:", err);
    querySucceeded = false;
  }

  // Build static entries with content-derived lastmod (or deploy fallback)
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((s) => ({
    url: `${BASE_URL}${s.path}`,
    lastModified: siteLastModified,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
    alternates: withAlternates(s.path),
  }));

  const result = [...staticEntries, ...categoryEntries, ...knowledgeEntries];

  const now = Date.now();

  if (querySucceeded) {
    globalThis.__sitemapCache = { data: result, createdAt: now, expiresAt: now + CACHE_TTL_MS };
    return result;
  }

  // DB failure path: serve stale cache if within MAX_STALE_MS
  if (globalThis.__sitemapCache && (now - globalThis.__sitemapCache.createdAt) < MAX_STALE_MS) {
    const staleDeadline = globalThis.__sitemapCache.createdAt + MAX_STALE_MS;
    globalThis.__sitemapCache.expiresAt = Math.min(now + ERROR_RETRY_MS, staleDeadline);
    return globalThis.__sitemapCache.data;
  }

  // Cold start with no cache or stale cache expired: return static entries with short TTL
  console.error("[sitemap] DB unavailable, returning static entries only");
  globalThis.__sitemapCache = { data: staticEntries, createdAt: now, expiresAt: now + ERROR_RETRY_MS };
  return staticEntries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = Date.now();
  if (globalThis.__sitemapCache && globalThis.__sitemapCache.expiresAt > now) {
    return globalThis.__sitemapCache.data;
  }

  // Deduplicate concurrent requests to prevent cache stampede
  if (globalThis.__sitemapInflight) {
    return globalThis.__sitemapInflight;
  }

  const promise = fetchSitemap();
  globalThis.__sitemapInflight = promise;
  try {
    return await promise;
  } finally {
    globalThis.__sitemapInflight = undefined;
  }
}
