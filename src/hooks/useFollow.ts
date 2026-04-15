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
    // Guard against parallel calls while a transition is already in-flight
    if (isPending) return;

    // Functional updates: always reads the latest state, not a stale closure
    setFollowing((prev) => !prev);
    setCount((prev) => (following ? Math.max(0, prev - 1) : prev + 1));

    startTransition(async () => {
      try {
        const result = await toggleFollowAction(targetUserId);
        if (result.error) {
          // Rollback: reverse the optimistic changes
          setFollowing((prev) => !prev);
          setCount((prev) => (following ? prev + 1 : Math.max(0, prev - 1)));
        } else {
          // Accept server truth
          setFollowing(result.following);
        }
      } catch {
        // requireAuth redirect or network error — rollback
        setFollowing((prev) => !prev);
        setCount((prev) => (following ? prev + 1 : Math.max(0, prev - 1)));
      }
    });
  }, [isPending, following, targetUserId]);

  return { following, count, isPending, toggle };
}
