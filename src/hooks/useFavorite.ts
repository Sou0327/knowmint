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
    // Guard against parallel calls while a transition is already in-flight
    if (isPending) return;

    // Functional update: always reads the latest state, not a stale closure
    setFavorited((current) => {
      const next = !current;
      if (next) {
        setAnimating(true);
        timerRef.current = setTimeout(() => setAnimating(false), 400);
      }
      return next;
    });

    startTransition(async () => {
      try {
        const result = await toggleFavoriteAction(itemId);
        if (result.error) {
          // Rollback with functional update so we don't rely on stale closure
          setFavorited((c) => !c);
          setAnimating(false);
        } else {
          setFavorited(result.favorited);
        }
      } catch {
        // requireAuth redirect or network error — rollback
        setFavorited((c) => !c);
        setAnimating(false);
      }
    });
  }, [isPending, itemId]);

  return { favorited, animating, isPending, toggle };
}
