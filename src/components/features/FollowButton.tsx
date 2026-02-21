"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount ?? 0);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.id === targetUserId) return;

      if (following) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId);
        if (!error) {
          setFollowing(false);
          setCount((c) => Math.max(0, c - 1));
        }
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: targetUserId });
        if (!error) {
          setFollowing(true);
          setCount((c) => c + 1);
        }
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={following ? "outline" : "primary"}
        size="sm"
        loading={isPending}
        onClick={toggle}
        aria-label={following ? "フォローを解除" : "フォローする"}
        aria-pressed={following}
      >
        {following ? "フォロー中" : "フォローする"}
      </Button>
      {count > 0 && (
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {count.toLocaleString()} フォロワー
        </span>
      )}
    </div>
  );
}
