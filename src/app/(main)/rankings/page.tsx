import { getTopSellers } from "@/lib/rankings/queries";
import SellerRankingCard from "@/components/features/SellerRankingCard";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  const topSellers = await getTopSellers(20);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">出品者ランキング</h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        販売実績の多い出品者をランキング表示しています
      </p>

      {topSellers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">まだランキングデータがありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topSellers.map((seller, i) => (
            <SellerRankingCard key={seller.id} seller={seller} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
