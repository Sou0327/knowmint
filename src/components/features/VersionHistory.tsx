"use client";

import { useCallback, useEffect, useReducer, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { fetchVersionHistory } from "@/app/(main)/knowledge/actions";

interface VersionEntry {
  id: string;
  knowledge_item_id: string;
  version_number: number;
  title: string;
  description: string;
  preview_content: string | null;
  price_sol: number | null;
  price_usdc: number | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  changed_by: string;
  change_summary: string | null;
  created_at: string;
}

interface VersionHistoryProps {
  knowledgeItemId: string;
}

type State = {
  versions: VersionEntry[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
};

type Action =
  | { type: "FETCH_SUCCESS"; versions: VersionEntry[]; totalPages: number }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "SET_PAGE"; page: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_SUCCESS":
      return { ...state, loading: false, versions: action.versions, totalPages: action.totalPages };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.error };
    case "SET_PAGE":
      return { ...state, loading: true, error: null, page: action.page };
  }
}

export function VersionHistory({ knowledgeItemId }: VersionHistoryProps) {
  const t = useTranslations("VersionHistory");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [state, dispatch] = useReducer(reducer, {
    versions: [],
    loading: true,
    error: null,
    page: 1,
    totalPages: 1,
  });
  const [, startTransition] = useTransition();

  const { versions, loading, error, page, totalPages } = state;
  const unknownErrorMsg = t("unknownError");

  const setPage = useCallback((updater: (prev: number) => number) => {
    dispatch({ type: "SET_PAGE", page: updater(page) });
  }, [page]);

  useEffect(() => {
    let cancelled = false;

    startTransition(async () => {
      try {
        const result = await fetchVersionHistory(knowledgeItemId, page);
        if (cancelled) return;
        if (result.error) {
          dispatch({ type: "FETCH_ERROR", error: result.error });
        } else {
          dispatch({
            type: "FETCH_SUCCESS",
            versions: result.data,
            totalPages: result.totalPages,
          });
        }
      } catch (err) {
        if (cancelled) return;
        dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : unknownErrorMsg });
      }
    });

    return () => { cancelled = true; };
  }, [knowledgeItemId, page, unknownErrorMsg]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-dq-text-muted">
        {tCommon("loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-dq-red">
        {t("error", { error })}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-dq-text-muted">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-dq-gold">{t("title")}</h3>
      <ul className="divide-y divide-dq-border rounded-sm border-2 border-dq-border">
        {versions.map((v) => (
          <li key={v.id} className="flex items-start gap-4 px-4 py-3">
            <span className="mt-0.5 flex h-6 w-10 flex-shrink-0 items-center justify-center rounded-sm bg-dq-surface text-xs font-mono font-semibold text-dq-cyan">
              v{v.version_number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-dq-text">{v.title}</p>
              {v.change_summary ? (
                <p className="mt-0.5 text-xs text-dq-text-muted">{v.change_summary}</p>
              ) : (
                <p className="mt-0.5 text-xs text-dq-text-muted italic">{t("noSummary")}</p>
              )}
            </div>
            <time
              dateTime={v.created_at}
              className="flex-shrink-0 text-xs text-dq-text-muted"
              title={new Date(v.created_at).toLocaleString(locale)}
            >
              {new Date(v.created_at).toLocaleDateString(locale)}
            </time>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-sm px-3 py-1 text-sm text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tCommon("previous")}
          </button>
          <span className="text-xs text-dq-text-muted">
            {t("pageIndicator", { page, totalPages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-sm px-3 py-1 text-sm text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tCommon("next")}
          </button>
        </div>
      )}
    </div>
  );
}
