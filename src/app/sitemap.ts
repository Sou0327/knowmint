import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const BASE_URL = "https://knowmint.shop";

const STATIC_PATHS = [
  { path: "/", changeFrequency: "daily" as const, priority: 1.0 },
  { path: "/search", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/rankings", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/faq", changeFrequency: "monthly" as const, priority: 0.5 },
  ...["/terms", "/privacy", "/legal", "/contact"].map((p) => ({
    path: p,
    changeFrequency: "monthly" as const,
    priority: 0.3,
  })),
];

function withAlternates(path: string) {
  return {
    languages: {
      en: `${BASE_URL}${path}`,
      ja: `${BASE_URL}/ja${path}`,
    },
  };
}

const MAX_SITEMAP_URLS = 50000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((s) => ({
    url: `${BASE_URL}${s.path}`,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
    alternates: withAlternates(s.path),
  }));

  let categoryEntries: MetadataRoute.Sitemap = [];
  let knowledgeEntries: MetadataRoute.Sitemap = [];

  try {
    const { getAdminClient } = await import("@/lib/supabase/admin");
    const admin = getAdminClient();

    // Fetch categories first (small result set)
    const { data: categories, error: catError } = await admin
      .from("categories")
      .select("slug");

    if (catError) {
      console.error("[sitemap] categories query failed:", catError.message);
    } else {
      categoryEntries = (categories ?? []).map((cat) => {
        const path = `/category/${cat.slug}`;
        return {
          url: `${BASE_URL}${path}`,
          changeFrequency: "daily" as const,
          priority: 0.7,
          alternates: withAlternates(path),
        };
      });
    }

    // Cap categories within budget
    const categoryBudget = MAX_SITEMAP_URLS - staticEntries.length;
    if (categoryEntries.length > categoryBudget) {
      categoryEntries = categoryEntries.slice(0, categoryBudget);
    }

    // Calculate remaining budget for knowledge items
    const knowledgeLimit = Math.max(0, MAX_SITEMAP_URLS - staticEntries.length - categoryEntries.length);

    if (knowledgeLimit === 0) {
      return [...staticEntries, ...categoryEntries];
    }

    const { data, error } = await admin
      .from("knowledge_items")
      .select("id, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(knowledgeLimit);

    if (error) {
      console.error("[sitemap] DB query failed:", error.message);
    } else {
      knowledgeEntries = data.map((item) => {
        const path = `/knowledge/${item.id}`;
        return {
          url: `${BASE_URL}${path}`,
          lastModified: new Date(item.updated_at),
          changeFrequency: "weekly" as const,
          priority: 0.8,
          alternates: withAlternates(path),
        };
      });
    }
  } catch (err) {
    console.error("[sitemap] Failed to fetch sitemap data:", err);
  }

  return [...staticEntries, ...categoryEntries, ...knowledgeEntries];
}
