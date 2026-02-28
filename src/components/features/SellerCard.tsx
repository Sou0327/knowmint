import Link from "next/link";
import Card from "@/components/ui/Card";
import { getTranslations } from "next-intl/server";
import { TRUST_HIGH_THRESHOLD, TRUST_THRESHOLD } from "@/types/knowledge.types";
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

export default async function SellerCard({
  seller,
  isFollowing,
  followerCount,
  heading,
}: Props) {
  const [t, tCommon, tProfile] = await Promise.all([
    getTranslations("Knowledge"),
    getTranslations("Common"),
    getTranslations("Profile"),
  ]);
  const resolvedHeading = heading ?? t("seller");

  return (
    <Card padding="md">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-dq-text-muted">
        {resolvedHeading}
      </p>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-dq-surface text-base font-bold text-dq-cyan border-2 border-dq-border">
          {(seller.display_name || "?")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/search?seller=${seller.id}`}
              className="text-base font-medium text-dq-text hover:text-dq-gold"
            >
              {seller.display_name || tCommon("anonymousUser")}
            </Link>
            {seller.trust_score != null && seller.trust_score >= TRUST_HIGH_THRESHOLD && (
              <span className="inline-flex items-center rounded-sm border border-dq-green/40 bg-dq-green/20 px-2 py-0.5 text-xs font-medium text-dq-green">
                {tProfile("trustHigh")}
              </span>
            )}
            {seller.trust_score != null && seller.trust_score >= TRUST_THRESHOLD && seller.trust_score < TRUST_HIGH_THRESHOLD && (
              <span className="inline-flex items-center rounded-sm border border-dq-yellow/40 bg-dq-yellow/20 px-2 py-0.5 text-xs font-medium text-dq-yellow">
                {tProfile("trust")}
              </span>
            )}
          </div>
          {seller.user_type && (
            <p className="mt-0.5 text-xs text-dq-text-muted">
              {seller.user_type === "agent" ? tProfile("userTypeAgent") : tProfile("userTypeHuman")}
            </p>
          )}
          {seller.bio && (
            <p className="mt-1 line-clamp-2 text-sm text-dq-text-sub">
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
