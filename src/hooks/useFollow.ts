"use client";

import { useState, useTransition, useCallback } from "react";
import { toggleFollowAction } from "@/app/actions/social";

export function useFollow(
  targetUserId: string,
  initialFollowing: boolean,
  initialCount?: number
) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount ?? 0);
  const [isPending, startTransition] = useTransition();

  const toggle = useCallback(() => {
    const prevFollowing = following;
    const prevCount = count;
    // Optimistic update
    setFollowing(!prevFollowing);
    setCount(
      prevFollowing ? Math.max(0, prevCount - 1) : prevCount + 1
    );

    startTransition(async () => {
      try {
        const result = await toggleFollowAction(targetUserId);
        if (result.error) {
          setFollowing(prevFollowing);
          setCount(prevCount);
        } else {
          setFollowing(result.following);
        }
      } catch {
        // requireAuth redirect or network error — rollback
        setFollowing(prevFollowing);
        setCount(prevCount);
      }
    });
  }, [following, count, targetUserId]);

  return { following, count, isPending, toggle };
}
