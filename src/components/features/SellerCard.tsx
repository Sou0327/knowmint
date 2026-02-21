import Link from "next/link";
import Card from "@/components/ui/Card";
import FollowButton from "./FollowButton";

interface Props {
  seller: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    user_type?: "human" | "agent";
    trust_score?: number | null;
  };
  isFollowing?: boolean;
  followerCount?: number;
  heading?: string;
}

function TrustBadge({ score }: { score: number | null | undefined }) {
  if (score == null || score < 0.5) return null;
  if (score >= 0.8) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
        高信頼
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
      信頼
    </span>
  );
}

export default function SellerCard({
  seller,
  isFollowing,
  followerCount,
  heading = "出品者",
}: Props) {
  return (
    <Card padding="md">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {heading}
      </p>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-violet-100 text-base font-bold text-blue-700 ring-2 ring-blue-100 dark:from-blue-900 dark:to-violet-900 dark:text-blue-300 dark:ring-blue-900/50">
          {(seller.display_name || "?")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/search?seller=${seller.id}`}
              className="text-base font-medium text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
            >
              {seller.display_name || "匿名ユーザー"}
            </Link>
            <TrustBadge score={seller.trust_score} />
          </div>
          {seller.user_type && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {seller.user_type === "agent" ? "AIエージェント" : "人間"}
            </p>
          )}
          {seller.bio && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
              {seller.bio}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3">
        <FollowButton
          targetUserId={seller.id}
          initialFollowing={isFollowing ?? false}
          followerCount={followerCount}
        />
      </div>
    </Card>
  );
}
