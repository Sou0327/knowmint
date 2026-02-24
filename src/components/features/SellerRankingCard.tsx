import Link from "next/link";
import type { TopSeller } from "@/lib/rankings/queries";

interface Props {
  seller: TopSeller;
  rank: number;
}

export default function SellerRankingCard({ seller, rank }: Props) {
  const rankStyles: Record<number, string> = {
    1: "bg-dq-gold text-dq-bg",
    2: "bg-dq-text-sub text-dq-bg",
    3: "bg-dq-gold/60 text-dq-bg",
  };

  return (
    <div className="flex items-center gap-4 dq-window-sm p-4 transition-all hover:brightness-110">
      {/* Rank */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-sm font-bold ${
          rankStyles[rank] ?? "bg-dq-surface text-dq-text-muted"
        }`}
      >
        {rank}
      </div>

      {/* Avatar */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-dq-surface text-base font-bold text-dq-cyan border-2 border-dq-border">
        {(seller.display_name || "?")[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/search?seller=${seller.id}`}
          className="text-sm font-semibold text-dq-text hover:text-dq-gold"
        >
          {seller.display_name || "匿名ユーザー"}
        </Link>
        <div className="mt-1 flex items-center gap-4 text-xs text-dq-text-muted">
          <span>{seller.total_sales} 販売</span>
          <span>{seller.total_items} アイテム</span>
          <span>{seller.follower_count} フォロワー</span>
          {seller.trust_score != null && (
            <span className="font-medium text-dq-cyan">
              信頼度 {Math.round(seller.trust_score * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
