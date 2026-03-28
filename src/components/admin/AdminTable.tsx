import type { ReactNode } from "react";

interface AdminTableProps {
  headers: { key: string; label: string; className?: string }[];
  children: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
  totalCount?: number;
}

export default function AdminTable({
  headers,
  children,
  emptyMessage = "No data found",
  isEmpty = false,
  totalCount,
}: AdminTableProps) {
  if (isEmpty) {
    return (
      <div className="dq-window p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-dq-text-muted opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p className="mt-3 text-sm text-dq-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {totalCount != null && (
        <p className="mb-2 text-xs text-dq-text-muted tabular-nums">
          {totalCount.toLocaleString()} results
        </p>
      )}
      <div className="dq-window overflow-x-auto" role="region" aria-label="Data table" tabIndex={0}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-dq-window-bg">
            <tr className="border-b-2 border-dq-border">
              {headers.map((h) => (
                <th
                  key={h.key}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dq-gold ${h.className ?? ""}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dq-border">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
