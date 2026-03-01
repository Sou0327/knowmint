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
  // userId を recs と一緒に管理し、ユーザー切替時に古いデータが表示されないようにする
  const [recsState, setRecsState] = useState<{
    userId: string | null;
    data: RecommendationRow[];
  }>({ userId: null, data: [] });
  const fetchedForRef = useRef<string | null>(null);

  // 現在のユーザーと userId が一致する場合のみ表示
  const recs = recsState.userId === (user?.id ?? null) ? recsState.data : [];

  useEffect(() => {
    if (!user) return;
    if (fetchedForRef.current === user.id) return;

    const controller = new AbortController();
    let committed = false;

    fetch("/api/v1/me/recommendations", { signal: controller.signal })
      .then(
        (r) => (r.ok ? r.json() : undefined),
        () => undefined
      )
      .then((d: { data?: RecommendationRow[] } | undefined) => {
        if (d?.data) {
          committed = true;
          fetchedForRef.current = user.id;
          setRecsState({ userId: user.id, data: d.data });
        } else if (!controller.signal.aborted) {
          fetchedForRef.current = null;
        }
      }, () => {
        if (!controller.signal.aborted) fetchedForRef.current = null;
      });

    return () => {
      controller.abort();
      if (!committed) fetchedForRef.current = null;
    };
  }, [user]);

  if (recs.length === 0) return null;

  return <RecommendationSection title={title} items={recs} />;
}
