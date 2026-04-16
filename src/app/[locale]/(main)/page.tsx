import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import PersonalRecommendationsClient from "@/components/features/PersonalRecommendationsClient";
import { getPublishedKnowledge, getCategories } from "@/lib/knowledge/queries";
import { getTopSellers } from "@/lib/rankings/queries";
import { getAdminClient } from "@/lib/supabase/admin";
import SellerRankingCard from "@/components/features/SellerRankingCard";
import { JsonLd } from "@/components/seo/JsonLd";
import HowItWorksSection from "@/components/features/HowItWorksSection";
import StatsBanner from "@/components/features/StatsBanner";
import ValuePropsSection from "@/components/features/ValuePropsSection";
import FinalCtaSection from "@/components/features/FinalCtaSection";
import EmailCaptureSection from "@/components/features/EmailCaptureSection";
// F-9: sections に抽出
import { HomeHeroSection } from "@/components/features/HomeHeroSection";
import { HomeCategoriesSection } from "@/components/features/HomeCategoriesSection";
import { HomeKnowledgeGrid } from "@/components/features/HomeKnowledgeGrid";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const [tHome, { locale }] = await Promise.all([
    getTranslations("Home"),
    params,
  ]);
  return {
    alternates: buildAlternates("/", locale),
    openGraph: {
      ...ogDefaults(locale),
      title: tHome("heroTitle"),
      type: "website",
    },
  };
}

// 公開データのみキャッシュ (cookies() 不使用の Admin クライアントを使用)
// dynamic rendering のままでも DB クエリを 60 秒間キャッシュし TTFB を削減
const getCachedHomeData = unstable_cache(
  async () => {
    const admin = getAdminClient();
    const [newest, popular, categories, topSellers, countData] = await Promise.all([
      getPublishedKnowledge({ sort_by: "newest", per_page: 6 }, admin),
      getPublishedKnowledge({ sort_by: "popular", per_page: 6 }, admin),
      getCategories(admin),
      getTopSellers(5),
      admin
        .from("knowledge_items")
        .select("category_id")
        .eq("status", "published"),
    ]);
    // カテゴリは常に存在するはず。空ならDB障害とみなしキャッシュしない
    if (categories.length === 0) {
      throw new Error("home data unavailable: categories empty");
    }
    const categoryCounts: Record<string, number> = {};
    if (countData.data) {
      for (const row of countData.data) {
        if (row.category_id) {
          categoryCounts[row.category_id] = (categoryCounts[row.category_id] ?? 0) + 1;
        }
      }
    }
    return { newest, popular, categories, topSellers, categoryCounts };
  },
  ["home-data"],
  { revalidate: 60 }
);

export default async function HomePage() {
  const [tHome, tCommon, tTypes, locale] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
    getTranslations("Types"),
    getLocale(),
  ]);

  // DB 障害時はキャッシュせずに空データでフォールバック
  const { newest, popular, categories, topSellers, categoryCounts } = await getCachedHomeData().catch(() => ({
    newest: { data: [], total: 0, page: 1, per_page: 6, total_pages: 0 },
    popular: { data: [], total: 0, page: 1, per_page: 6, total_pages: 0 },
    categories: [] as Awaited<ReturnType<typeof getCategories>>,
    topSellers: [] as Awaited<ReturnType<typeof getTopSellers>>,
    categoryCounts: {} as Record<string, number>,
  }));

  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const baseUrl = `https://knowmint.shop${localePrefix}`;

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "KnowMint",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${baseUrl}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://knowmint.shop/#organization",
    name: "KnowMint",
    url: "https://knowmint.shop",
    logo: {
      "@type": "ImageObject",
      url: "https://knowmint.shop/icon.png",
      width: 512,
      height: 512,
    },
    foundingDate: "2026-01-15",
    description: "AI-native knowledge marketplace where AI agents autonomously purchase human expertise using x402 protocol on Solana",
    email: "contact@knowmint.shop",
    knowsAbout: [
      "AI Agent Commerce",
      "x402 Protocol",
      "Solana Blockchain",
      "Knowledge Marketplace",
      "Model Context Protocol",
    ],
    sameAs: [
      "https://github.com/Sou0327/knowmint",
      "https://www.npmjs.com/package/@knowmint/mcp-server",
      "https://x.com/gensou_ongaku",
      "https://www.wikidata.org/wiki/Q138664028",
      "https://www.linkedin.com/in/souokumura/",
    ],
  };

  return (
    <div className="space-y-16">
      <JsonLd data={websiteJsonLd} />
      <JsonLd data={organizationJsonLd} />

      {/* Hero */}
      <HomeHeroSection
        translations={{
          heroCatchphrase: tHome("heroCatchphrase"),
          heroTagline: tHome("heroTagline"),
          exploreMarket: tHome("exploreMarket"),
          heroSubCtaLabel: tHome("heroSubCtaLabel"),
          heroSellerCta: tHome("heroSellerCta"),
          heroSellerCtaLink: tHome("heroSellerCtaLink"),
        }}
      />

      {/* AI-citable definition */}
      <AnimateOnScroll animation="scale-in">
        <section className="mx-auto max-w-3xl rounded-sm dq-window p-6 text-center sm:p-8">
          <h2 className="mb-4 font-display text-xl font-bold text-dq-gold">
            {tHome("definitionHeading")}
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-dq-text-sub">
            {tHome("definitionLine1")}
          </p>
          <p className="mb-3 text-sm leading-relaxed text-dq-text-sub">
            {tHome("definitionLine2")}
          </p>
          <p className="text-sm leading-relaxed text-dq-text-sub">
            {tHome("definitionLine3")}
          </p>
        </section>
      </AnimateOnScroll>

      <p className="text-center text-xs text-dq-text-muted">{tHome("lastUpdated")}</p>

      {/* Stats Banner */}
      <StatsBanner />

      {/* Value Props */}
      <ValuePropsSection />

      {/* How It Works for AI Agents */}
      <div id="how-it-works">
        <HowItWorksSection />
      </div>

      {/* Personal Recommendations (client-side, login users only) */}
      <Suspense fallback={null}>
        <PersonalRecommendationsClient title={tHome("recommended")} />
      </Suspense>

      {/* Categories */}
      <HomeCategoriesSection
        tHome={tHome}
        tTypes={tTypes}
        categories={categories}
        categoryCounts={categoryCounts}
      />

      {/* Newest */}
      <HomeKnowledgeGrid
        tHome={tHome}
        tCommon={tCommon}
        items={newest.data}
        title={tHome("new")}
        viewAllHref="/search?sort=newest"
        showEmpty
      />

      {/* Popular */}
      <HomeKnowledgeGrid
        tHome={tHome}
        tCommon={tCommon}
        items={popular.data}
        title={tHome("popular")}
        viewAllHref="/search?sort=popular"
      />

      {/* Final CTA */}
      <FinalCtaSection />

      {/* Email Capture */}
      <EmailCaptureSection />

      {/* Top Sellers */}
      {topSellers.length > 0 && (
        <section>
          <AnimateOnScroll animation="fade-up">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-1 items-center gap-4">
                <h2 className="shrink-0 font-display text-xl font-bold text-dq-gold">
                  {tHome("topSellers")}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-dq-border to-transparent" />
              </div>
              <Link
                href="/rankings"
                className="group ml-4 text-sm text-dq-cyan hover:text-dq-gold"
              >
                {tHome("viewRankings")}{" "}
                <span className="inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
            </div>
          </AnimateOnScroll>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topSellers.slice(0, 3).map((seller, i) => (
              <AnimateOnScroll key={seller.id} animation="fade-up" delay={i * 100}>
                <SellerRankingCard seller={seller} rank={i + 1} />
              </AnimateOnScroll>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
