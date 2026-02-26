import Link from "next/link";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import RecommendationSection, { type SupabaseKnowledgeRow } from "@/components/features/RecommendationSection";
import { getPublishedKnowledge, getCategories } from "@/lib/knowledge/queries";
import { getPersonalRecommendations } from "@/lib/recommendations/queries";
import { getTopSellers } from "@/lib/rankings/queries";
import SellerRankingCard from "@/components/features/SellerRankingCard";
import { createClient } from "@/lib/supabase/server";
import type { ListingType } from "@/types/database.types";
import { JsonLd } from "@/components/seo/JsonLd";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [tHome, tCommon, tNav] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
    getTranslations("Nav"),
  ]);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [newest, popular, categories, personalRecs, topSellers] = await Promise.all([
    getPublishedKnowledge({ sort_by: "newest", per_page: 6 }),
    getPublishedKnowledge({ sort_by: "popular", per_page: 6 }),
    getCategories(),
    user ? getPersonalRecommendations(user.id).then((d) => d as SupabaseKnowledgeRow[]) : Promise.resolve([] as SupabaseKnowledgeRow[]),
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
      <section className="py-8 text-center">
        <h1 className="text-5xl font-bold leading-tight tracking-tight text-dq-gold sm:text-6xl">
          KnowMint
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-dq-text-sub sm:text-xl">
          {tHome("heroDescription")}
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/search"
            className="rounded-sm bg-dq-gold px-6 py-3 text-sm font-medium text-dq-bg transition-colors hover:brightness-110"
          >
            {tHome("exploreMarket")}
          </Link>
          <Link
            href="/list"
            className="rounded-sm border-2 border-dq-border px-6 py-3 text-sm font-medium text-dq-text-sub transition-colors hover:bg-dq-surface hover:text-dq-gold"
          >
            {tNav("listItem")}
          </Link>
        </div>
      </section>

      {/* Personal Recommendations */}
      {personalRecs.length > 0 && (
        <RecommendationSection title={tHome("recommended")} items={personalRecs} />
      )}

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-center gap-4">
          <h2 className="shrink-0 text-xl font-bold text-dq-gold">
            カテゴリ
          </h2>
          <div className="h-px flex-1 bg-dq-border" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group rounded-sm dq-window-sm p-4 text-center transition-all hover:brightness-110"
            >
              <span className="text-sm font-medium text-dq-text-sub transition-colors group-hover:text-dq-gold">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Newest */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-1 items-center gap-4">
            <h2 className="shrink-0 text-xl font-bold text-dq-gold">
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
          {newest.data.map((item: Record<string, unknown>) => (
            <KnowledgeCard
              key={item.id as string}
              id={item.id as string}
              listing_type={item.listing_type as ListingType}
              title={item.title as string}
              description={item.description as string}
              content_type={item.content_type as "prompt" | "tool_def" | "dataset" | "api" | "general"}
              price_sol={item.price_sol as number | null}
              price_usdc={item.price_usdc as number | null}
              seller={item.seller as { display_name: string | null }}
              category={item.category as { name: string } | null}
              tags={item.tags as string[]}
              average_rating={item.average_rating as number | null}
              purchase_count={item.purchase_count as number}
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
            <h2 className="shrink-0 text-xl font-bold text-dq-gold">
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
          {popular.data.map((item: Record<string, unknown>) => (
            <KnowledgeCard
              key={item.id as string}
              id={item.id as string}
              listing_type={item.listing_type as ListingType}
              title={item.title as string}
              description={item.description as string}
              content_type={item.content_type as "prompt" | "tool_def" | "dataset" | "api" | "general"}
              price_sol={item.price_sol as number | null}
              price_usdc={item.price_usdc as number | null}
              seller={item.seller as { display_name: string | null }}
              category={item.category as { name: string } | null}
              tags={item.tags as string[]}
              average_rating={item.average_rating as number | null}
              purchase_count={item.purchase_count as number}
            />
          ))}
        </div>
      </section>

      {/* Top Sellers */}
      {topSellers.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex flex-1 items-center gap-4">
              <h2 className="shrink-0 text-xl font-bold text-dq-gold">
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
