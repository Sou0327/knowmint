import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const BASE_URL = "https://knowmint.shop";

const STATIC_PATHS = [
  { path: "/", changeFrequency: "daily" as const, priority: 1.0 },
  { path: "/rankings", changeFrequency: "daily" as const, priority: 0.7 },
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

  let knowledgeEntries: MetadataRoute.Sitemap = [];
  try {
    const { getAdminClient } = await import("@/lib/supabase/admin");
    const { data, error } = await getAdminClient()
      .from("knowledge_items")
      .select("id, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(MAX_SITEMAP_URLS - STATIC_PATHS.length);

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
    console.error("[sitemap] Failed to fetch knowledge items:", err);
  }

  return [...staticEntries, ...knowledgeEntries];
}
