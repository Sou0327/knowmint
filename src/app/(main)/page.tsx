import Link from "next/link";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import RecommendationSection from "@/components/features/RecommendationSection";
import { getPublishedKnowledge, getCategories } from "@/lib/knowledge/queries";
import { getPersonalRecommendations } from "@/lib/recommendations/queries";
import { getTopSellers } from "@/lib/rankings/queries";
import SellerRankingCard from "@/components/features/SellerRankingCard";
import { createClient } from "@/lib/supabase/server";
import { JsonLd } from "@/components/seo/JsonLd";
import HowItWorksSection from "@/components/features/HowItWorksSection";
import { getTranslations } from "next-intl/server";
import { getCategoryDisplayName } from "@/lib/i18n/category";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [tHome, tCommon, tNav, tTypes] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
    getTranslations("Nav"),
    getTranslations("Types"),
  ]);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [newest, popular, categories, personalRecs, topSellers] = await Promise.all([
    getPublishedKnowledge({ sort_by: "newest", per_page: 6 }),
    getPublishedKnowledge({ sort_by: "popular", per_page: 6 }),
    getCategories(),
    user ? getPersonalRecommendations(user.id) : Promise.resolve([]),
    getTopSellers(5),
  ]);

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
          <h1 className="font-display text-5xl font-bold leading-tight tracking-wide text-dq-gold text-glow-gold sm:text-7xl">
            Know<span className="tracking-normal">Mint</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-dq-text-sub sm:text-xl">
            {tHome("heroDescription")}
          </p>
          <div className="mt-12 flex justify-center gap-4">
            <Link
              href="/search"
              className="rounded-sm bg-dq-gold px-7 py-3.5 text-sm font-semibold text-dq-bg shadow-[0_0_20px_rgba(245,197,66,0.25)] transition-all hover:brightness-110 hover:shadow-[0_0_30px_rgba(245,197,66,0.35)]"
            >
              {tHome("exploreMarket")}
            </Link>
            <Link
              href="/list"
              className="rounded-sm border-2 border-dq-border px-7 py-3.5 text-sm font-semibold text-dq-text-sub transition-all hover:border-dq-gold/40 hover:bg-dq-surface hover:text-dq-gold"
            >
              {tNav("listItem")}
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works for AI Agents */}
      <HowItWorksSection />

      {/* Personal Recommendations */}
      {personalRecs.length > 0 && (
        <RecommendationSection title={tHome("recommended")} items={personalRecs} />
      )}

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-center gap-4">
          <h2 className="shrink-0 text-xl font-bold font-display text-dq-gold">
            {tHome("categories")}
          </h2>
          <div className="h-px flex-1 bg-dq-border" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group rounded-sm dq-window-sm dq-window-hover p-4 text-center"
            >
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
            <h2 className="shrink-0 text-xl font-bold font-display text-dq-gold">
              {tHome("new")}
            </h2>
            <div className="h-px flex-1 bg-dq-border" />
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
            <p className="text-dq-text-muted">
              {tHome("noItemsYet")}
            </p>
          </div>
        )}
      </section>

      {/* Popular */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-1 items-center gap-4">
            <h2 className="shrink-0 text-xl font-bold font-display text-dq-gold">
              {tHome("popular")}
            </h2>
            <div className="h-px flex-1 bg-dq-border" />
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

      {/* Top Sellers */}
      {topSellers.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex flex-1 items-center gap-4">
              <h2 className="shrink-0 text-xl font-bold font-display text-dq-gold">
                {tHome("topSellers")}
              </h2>
              <div className="h-px flex-1 bg-dq-border" />
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
