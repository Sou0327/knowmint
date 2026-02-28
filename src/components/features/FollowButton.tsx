"use client";

import { useTranslations } from "next-intl";
import { useFollow } from "@/hooks/useFollow";
import Button from "@/components/ui/Button";

interface FollowButtonProps {
  targetUserId: string;
  initialFollowing: boolean;
  followerCount?: number;
}

export default function FollowButton({
  targetUserId,
  initialFollowing,
  followerCount: initialCount,
}: FollowButtonProps) {
  const t = useTranslations("Social");
  const { following, count, isPending, toggle } = useFollow(
    targetUserId,
    initialFollowing,
    initialCount
  );

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={following ? "outline" : "primary"}
        size="sm"
        loading={isPending}
        onClick={toggle}
        aria-label={following ? t("unfollow") : t("follow")}
        aria-pressed={following}
      >
        {following ? t("following") : t("follow")}
      </Button>
      {count > 0 && (
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {t("followerCount", { count: count.toLocaleString() })}
        </span>
      )}
    </div>
  );
}
