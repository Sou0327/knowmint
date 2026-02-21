import Link from "next/link";
import type { TopSeller } from "@/lib/rankings/queries";

interface Props {
  seller: TopSeller;
  rank: number;
}

export default function SellerRankingCard({ seller, rank }: Props) {
  const rankColors: Record<number, string> = {
    1: "from-yellow-400 to-amber-500 text-white",
    2: "from-zinc-300 to-zinc-400 text-white",
    3: "from-amber-600 to-amber-700 text-white",
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      {/* Rank */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          rankColors[rank] ??
          "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
        } ${rank <= 3 ? `bg-gradient-to-br ${rankColors[rank]}` : ""}`}
      >
        {rank}
      </div>

      {/* Avatar */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 text-base font-bold text-blue-700 ring-2 ring-blue-100 dark:from-blue-900 dark:to-violet-900 dark:text-blue-300 dark:ring-blue-900/50">
        {(seller.display_name || "?")[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/search?seller=${seller.id}`}
          className="text-sm font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
        >
          {seller.display_name || "匿名ユーザー"}
        </Link>
        <div className="mt-1 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{seller.total_sales} 販売</span>
          <span>{seller.total_items} アイテム</span>
          <span>{seller.follower_count} フォロワー</span>
          {seller.trust_score != null && (
            <span className="font-medium text-blue-600 dark:text-blue-400">
              信頼度 {Math.round(seller.trust_score * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
