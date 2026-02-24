"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

interface FavoriteButtonProps {
  itemId: string;
  initialFavorited: boolean;
  size?: "sm" | "md";
}

export default function FavoriteButton({
  itemId,
  initialFavorited,
  size = "md",
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [animating, setAnimating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toggle = () => {
    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (favorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("knowledge_item_id", itemId);
        if (!error) setFavorited(false);
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, knowledge_item_id: itemId });
        if (!error) {
          setFavorited(true);
          setAnimating(true);
          timerRef.current = setTimeout(() => setAnimating(false), 400);
        }
      }
    });
  };

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      loading={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      className={`rounded-sm !px-2 !py-2 ${
        favorited
          ? "text-dq-red hover:brightness-110"
          : "text-dq-text-muted hover:text-dq-red"
      }`}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorited}
    >
      <svg
        className={`${iconSize} transition-transform duration-200 ${
          animating ? "scale-125" : "scale-100"
        }`}
        viewBox="0 0 24 24"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </Button>
  );
}
