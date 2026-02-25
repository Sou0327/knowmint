import type { MetadataRoute } from "next";

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: "https://knowmint.shop", changeFrequency: "daily", priority: 1.0 },
  { url: "https://knowmint.shop/rankings", changeFrequency: "daily", priority: 0.7 },
  ...["/terms", "/privacy", "/legal", "/contact"].map((p) => ({
    url: `https://knowmint.shop${p}`,
    changeFrequency: "monthly" as const,
    priority: 0.3,
  })),
];

const MAX_SITEMAP_URLS = 50000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { getAdminClient } = await import("@/lib/supabase/admin");
  const { data } = await getAdminClient()
    .from("knowledge_items")
    .select("id, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(MAX_SITEMAP_URLS - STATIC_PAGES.length);

  const knowledgeEntries = (data ?? []).map((item) => ({
    url: `https://knowmint.shop/knowledge/${item.id}`,
    lastModified: new Date(item.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...STATIC_PAGES, ...knowledgeEntries];
}
