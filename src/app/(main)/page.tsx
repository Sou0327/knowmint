import Link from "next/link";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import RecommendationSection, { type SupabaseKnowledgeRow } from "@/components/features/RecommendationSection";
import { getPublishedKnowledge, getCategories } from "@/lib/knowledge/queries";
import { getPersonalRecommendations } from "@/lib/recommendations/queries";
import { getTopSellers } from "@/lib/rankings/queries";
import SellerRankingCard from "@/components/features/SellerRankingCard";
import { createClient } from "@/lib/supabase/server";
import type { ListingType } from "@/types/database.types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [newest, popular, categories, personalRecs, topSellers] = await Promise.all([
    getPublishedKnowledge({ sort_by: "newest", per_page: 6 }),
    getPublishedKnowledge({ sort_by: "popular", per_page: 6 }),
    getCategories(),
    user ? getPersonalRecommendations(user.id).then((d) => d as SupabaseKnowledgeRow[]) : Promise.resolve([] as SupabaseKnowledgeRow[]),
    getTopSellers(5),
  ]);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="py-8 text-center">
        <h1 className="bg-gradient-to-r from-zinc-900 via-blue-800 to-violet-800 bg-clip-text text-5xl font-bold leading-tight tracking-tight text-transparent dark:from-zinc-100 dark:via-blue-300 dark:to-violet-300 sm:text-6xl">
          Knowledge Market
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-xl">
          AIエージェントと人間のための知識マーケットプレイス。
          プロンプト、ツール定義、データセット、APIを売買できます。
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/search"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-blue-600/25 transition-all duration-300 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30"
          >
            マーケットを探す
          </Link>
          <Link
            href="/list"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-all duration-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            出品する
          </Link>
        </div>
      </section>

      {/* Personal Recommendations */}
      {personalRecs.length > 0 && (
        <RecommendationSection title="あなたへのおすすめ" items={personalRecs} />
      )}

      {/* Categories */}
      <section>
        <div className="mb-4 flex items-center gap-4">
          <h2 className="shrink-0 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            カテゴリ
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-zinc-200 to-transparent dark:from-zinc-700" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.slug}`}
              className="group rounded-xl border border-zinc-200 p-4 text-center transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md dark:border-zinc-700 dark:hover:border-blue-600 dark:hover:bg-blue-950"
            >
              <span className="text-sm font-medium text-zinc-700 transition-colors group-hover:text-blue-600 dark:text-zinc-300 dark:group-hover:text-blue-400">
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
            <h2 className="shrink-0 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              新着
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-zinc-200 to-transparent dark:from-zinc-700" />
          </div>
          <Link
            href="/search?sort=newest"
            className="group ml-4 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            すべて見る{" "}
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
              className="mx-auto mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600"
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
            <p className="text-zinc-500 dark:text-zinc-400">
              まだアイテムがありません
            </p>
          </div>
        )}
      </section>

      {/* Popular */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-1 items-center gap-4">
            <h2 className="shrink-0 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              人気
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-zinc-200 to-transparent dark:from-zinc-700" />
          </div>
          <Link
            href="/search?sort=popular"
            className="group ml-4 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            すべて見る{" "}
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
              <h2 className="shrink-0 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                人気の出品者
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-zinc-200 to-transparent dark:from-zinc-700" />
            </div>
            <Link
              href="/rankings"
              className="group ml-4 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              ランキングを見る{" "}
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
