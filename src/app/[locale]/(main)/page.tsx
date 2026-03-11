import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import KnowledgeCard from "@/components/features/KnowledgeCard";
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
import { getTranslations } from "next-intl/server";
import { getCategoryDisplayName } from "@/lib/i18n/category";

const CATEGORY_ICONS: Record<string, string> = {
  business: "💼",
  "technology-it": "💻",
  "design-creative": "🎨",
  "education-learning": "📖",
  lifestyle: "🌿",
  prompt: "💬",
  tool_def: "🔧",
  dataset: "📊",
  api: "🔌",
  general: "📚",
};

// 公開データのみキャッシュ (cookies() 不使用の Admin クライアントを使用)
// dynamic rendering のままでも DB クエリを 60 秒間キャッシュし TTFB を削減
const getCachedHomeData = unstable_cache(
  async () => {
    const admin = getAdminClient();
    const [newest, popular, categories, topSellers] = await Promise.all([
      getPublishedKnowledge({ sort_by: "newest", per_page: 6 }, admin),
      getPublishedKnowledge({ sort_by: "popular", per_page: 6 }, admin),
      getCategories(admin),
      getTopSellers(5, admin),
    ]);
    // カテゴリは常に存在するはず。空ならDB障害とみなしキャッシュしない
    if (categories.length === 0) {
      throw new Error("home data unavailable: categories empty");
    }
    return { newest, popular, categories, topSellers };
  },
  ["home-data"],
  { revalidate: 60 }
);

export default async function HomePage() {
  const [tHome, tCommon, tTypes] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
    getTranslations("Types"),
  ]);

  // DB 障害時はキャッシュせずに空データでフォールバック
  const { newest, popular, categories, topSellers } = await getCachedHomeData().catch(() => ({
    newest: { data: [], total: 0, page: 1, per_page: 6, total_pages: 0 },
    popular: { data: [], total: 0, page: 1, per_page: 6, total_pages: 0 },
    categories: [] as Awaited<ReturnType<typeof getCategories>>,
    topSellers: [] as Awaited<ReturnType<typeof getTopSellers>>,
  }));

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "KnowMint",
    url: "https://knowmint.shop",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://knowmint.shop/search?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="space-y-16">
      <JsonLd data={websiteJsonLd} />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-sm py-20 text-center sm:py-24">
        {/* Atmospheric background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,197,66,0.08),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(64,192,224,0.05),transparent_50%)]" />

        <div className="relative">
          {/* Eco badges */}
          <div className="mb-6 flex flex-wrap justify-center gap-2 sm:gap-3">
            <span className="dq-window-sm px-3 py-1 text-xs font-medium text-dq-cyan">
              x402 Protocol
            </span>
            <span className="self-center text-dq-text-muted" aria-hidden="true">·</span>
            <span className="dq-window-sm px-3 py-1 text-xs font-medium text-dq-gold">
              Solana
            </span>
            <span className="self-center text-dq-text-muted" aria-hidden="true">·</span>
            <span className="dq-window-sm px-3 py-1 text-xs font-medium text-dq-text-sub">
              MCP
            </span>
          </div>

          <h1 className="font-display text-5xl font-bold leading-tight tracking-wide text-dq-gold text-glow-gold sm:text-7xl">
            Know<span className="tracking-normal">Mint</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-dq-text-sub sm:text-xl">
            {tHome("heroCatchphrase")}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/search"
              className="rounded-sm bg-dq-gold px-9 py-4 text-sm font-bold text-dq-bg shadow-[0_0_30px_rgba(245,197,66,0.3)] transition-all hover:brightness-110 hover:shadow-[0_0_40px_rgba(245,197,66,0.4)]"
            >
              {tHome("exploreMarket")}
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-sm border-2 border-dq-cyan/50 px-9 py-4 text-sm font-semibold text-dq-cyan transition-all hover:border-dq-cyan hover:bg-dq-cyan/5"
            >
              {tHome("heroSubCtaLabel")}
            </Link>
          </div>

          {/* Stats strip */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <div className="text-center">
              <span className="font-display text-lg font-bold text-dq-gold">$10M+</span>
              <span className="ml-1.5 text-xs text-dq-text-muted">{tHome("statsX402Volume")}</span>
            </div>
            <span className="hidden text-dq-text-muted sm:inline" aria-hidden="true">·</span>
            <div className="text-center">
              <span className="font-display text-lg font-bold text-dq-gold">77%</span>
              <span className="ml-1.5 text-xs text-dq-text-muted">{tHome("statsAiAgentTx")}</span>
            </div>
            <span className="hidden text-dq-text-muted sm:inline" aria-hidden="true">·</span>
            <div className="text-center">
              <span className="font-display text-lg font-bold text-dq-gold">MCP · 3</span>
              <span className="ml-1.5 text-xs text-dq-text-muted">{tHome("statsMcpSdks")}</span>
            </div>
          </div>
        </div>
      </section>

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
      <section>
        <div className="mb-4 flex items-center gap-4">
          <h2 className="shrink-0 font-display text-xl font-bold text-dq-gold">
            {tHome("categories")}
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-dq-border to-transparent" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group rounded-sm dq-window-sm dq-window-hover p-4 text-center"
            >
              <span className="mb-2 block text-2xl" aria-hidden="true">
                {CATEGORY_ICONS[cat.slug] ?? "📋"}
              </span>
              <span className="text-sm font-medium text-dq-text-sub transition-colors group-hover:text-dq-gold">
                {getCategoryDisplayName(tTypes, cat.slug, cat.name)}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Newest */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-1 items-center gap-4">
            <h2 className="shrink-0 font-display text-xl font-bold text-dq-gold">
              {tHome("new")}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-dq-border to-transparent" />
          </div>
          <Link
            href="/search?sort=newest"
            className="group ml-4 text-sm text-dq-cyan hover:text-dq-gold"
          >
            {tCommon("viewAll")}{" "}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {newest.data.map((item) => (
            <KnowledgeCard
              key={item.id}
              id={item.id}
              listing_type={item.listing_type}
              title={item.title}
              description={item.description}
              content_type={item.content_type}
              price_sol={item.price_sol}
              seller={item.seller ?? { display_name: null }}
              category={item.category}
              tags={item.tags}
              average_rating={item.average_rating}
              purchase_count={item.purchase_count}
            />
          ))}
        </div>
        {newest.data.length === 0 && (
          <div className="py-12 text-center">
            <svg
              aria-hidden="true"
              className="mx-auto mb-3 h-10 w-10 text-dq-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.75 7.5h16.5"
              />
            </svg>
            <p className="text-dq-text-muted">{tHome("noItemsYet")}</p>
          </div>
        )}
      </section>

      {/* Popular */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-1 items-center gap-4">
            <h2 className="shrink-0 font-display text-xl font-bold text-dq-gold">
              {tHome("popular")}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-dq-border to-transparent" />
          </div>
          <Link
            href="/search?sort=popular"
            className="group ml-4 text-sm text-dq-cyan hover:text-dq-gold"
          >
            {tCommon("viewAll")}{" "}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {popular.data.map((item) => (
            <KnowledgeCard
              key={item.id}
              id={item.id}
              listing_type={item.listing_type}
              title={item.title}
              description={item.description}
              content_type={item.content_type}
              price_sol={item.price_sol}
              seller={item.seller ?? { display_name: null }}
              category={item.category}
              tags={item.tags}
              average_rating={item.average_rating}
              purchase_count={item.purchase_count}
            />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <FinalCtaSection />

      {/* Top Sellers */}
      {topSellers.length > 0 && (
        <section>
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topSellers.slice(0, 3).map((seller, i) => (
              <SellerRankingCard key={seller.id} seller={seller} rank={i + 1} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
