"use client";

import { useCallback, useEffect, useReducer, useTransition } from "react";
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
  const [state, dispatch] = useReducer(reducer, {
    versions: [],
    loading: true,
    error: null,
    page: 1,
    totalPages: 1,
  });
  const [, startTransition] = useTransition();

  const { versions, loading, error, page, totalPages } = state;

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
        dispatch({ type: "FETCH_ERROR", error: err instanceof Error ? err.message : "Unknown error" });
      }
    });

    return () => { cancelled = true; };
  }, [knowledgeItemId, page]);

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        Loading version history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-red-500">
        Failed to load version history: {error}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No version history yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-gray-900">Version History</h3>
      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
        {versions.map((v) => (
          <li key={v.id} className="flex items-start gap-4 px-4 py-3">
            <span className="mt-0.5 flex h-6 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-mono font-semibold text-gray-600">
              v{v.version_number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">{v.title}</p>
              {v.change_summary ? (
                <p className="mt-0.5 text-xs text-gray-500">{v.change_summary}</p>
              ) : (
                <p className="mt-0.5 text-xs text-gray-400 italic">No summary</p>
              )}
            </div>
            <time
              dateTime={v.created_at}
              className="flex-shrink-0 text-xs text-gray-400"
              title={new Date(v.created_at).toLocaleString()}
            >
              {new Date(v.created_at).toLocaleDateString()}
            </time>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
