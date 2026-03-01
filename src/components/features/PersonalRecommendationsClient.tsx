"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { RecommendationRow } from "@/lib/recommendations/queries";
import RecommendationSection from "./RecommendationSection";

interface Props {
  title: string;
}

export default function PersonalRecommendationsClient({ title }: Props) {
  const { user } = useAuth();
  const [recs, setRecs] = useState<RecommendationRow[]>([]);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      // ログアウト時にクリア (非同期で setState を呼ぶことで cascading render を回避)
      Promise.resolve().then(() => {
        setRecs([]);
        fetchedForRef.current = null;
      }, () => {});
      return;
    }

    // 同じユーザーの fetch は重複実行しない
    if (fetchedForRef.current === user.id) return;

    const controller = new AbortController();
    fetchedForRef.current = user.id;

    fetch("/api/v1/me/recommendations", { signal: controller.signal })
      .then(
        (r) => (r.ok ? r.json() : undefined),
        () => undefined
      )
      .then((d: { data?: RecommendationRow[] } | undefined) => {
        if (d?.data) setRecs(d.data);
      }, () => {});

    return () => {
      controller.abort();
    };
  }, [user]);

  if (recs.length === 0) return null;

  return <RecommendationSection title={title} items={recs} />;
}
