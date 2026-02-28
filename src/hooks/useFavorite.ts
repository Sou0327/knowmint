"use client";

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
import { toggleFavoriteAction } from "@/app/actions/social";

export function useFavorite(itemId: string, initialFavorited: boolean) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [animating, setAnimating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toggle = useCallback(() => {
    const prev = favorited;
    // Optimistic update
    setFavorited(!prev);
    if (!prev) {
      setAnimating(true);
      timerRef.current = setTimeout(() => setAnimating(false), 400);
    }

    startTransition(async () => {
      try {
        const result = await toggleFavoriteAction(itemId);
        if (result.error) {
          setFavorited(prev);
          setAnimating(false);
        } else {
          setFavorited(result.favorited);
        }
      } catch {
        // requireAuth redirect or network error — rollback
        setFavorited(prev);
        setAnimating(false);
      }
    });
  }, [favorited, itemId]);

  return { favorited, animating, isPending, toggle };
}
