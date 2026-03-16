"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ContentType } from "@/types/database.types";

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface SearchMobileFiltersProps {
  categories: Category[];
  contentTypes: ContentType[];
  currentCategory?: string;
  currentType?: string;
  buildUrl: (overrides: Record<string, string | undefined>) => string;
  labels: {
    filter: string;
    category: string;
    contentType: string;
    all: string;
    close: string;
  };
  categoryNames: Record<string, string>;
  typeNames: Record<string, string>;
}

export default function SearchMobileFilters({
  categories,
  contentTypes,
  currentCategory,
  currentType,
  buildUrl,
  labels,
  categoryNames,
  typeNames,
}: SearchMobileFiltersProps) {
  const [open, setOpen] = useState(false);

  const hasActiveFilter = Boolean(currentCategory || currentType);

  return (
    <>
      {/* Filter trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
          hasActiveFilter
            ? "bg-dq-gold text-dq-bg"
            : "border border-dq-border bg-dq-surface text-dq-text-sub hover:bg-dq-hover"
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Filter size={14} aria-hidden="true" />
        {labels.filter}
        {hasActiveFilter && (
          <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-dq-bg text-[10px] font-bold text-dq-gold">
            {(currentCategory ? 1 : 0) + (currentType ? 1 : 0)}
          </span>
        )}
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Bottom sheet panel */}
      <div
        role="dialog"
        aria-label={labels.filter}
        aria-modal="true"
        className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="dq-window-sm max-h-[80vh] overflow-y-auto rounded-t-lg bg-dq-window-bg">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between border-b border-dq-border bg-dq-window-bg px-4 py-3">
            <span className="font-display text-sm font-semibold text-dq-gold">
              {labels.filter}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-sm p-1 text-dq-text-sub hover:bg-dq-surface hover:text-dq-text"
              aria-label={labels.close}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-6 px-4 py-4">
            {/* Category filter */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dq-gold">
                {labels.category}
              </h3>
              <ul className="space-y-0.5">
                <li>
                  <Link
                    href={buildUrl({ category: undefined, page: undefined })}
                    onClick={() => setOpen(false)}
                    className={`block rounded-sm px-2 py-2 text-sm ${
                      !currentCategory
                        ? "bg-dq-surface font-medium text-dq-gold"
                        : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                    }`}
                  >
                    {labels.all}
                  </Link>
                </li>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={buildUrl({ category: cat.slug, page: undefined })}
                      onClick={() => setOpen(false)}
                      className={`block rounded-sm px-2 py-2 text-sm ${
                        currentCategory === cat.slug
                          ? "bg-dq-surface font-medium text-dq-gold"
                          : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                      }`}
                    >
                      {categoryNames[cat.slug] ?? cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            {/* Content type filter */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dq-gold">
                {labels.contentType}
              </h3>
              <ul className="space-y-0.5">
                <li>
                  <Link
                    href={buildUrl({ type: undefined, page: undefined })}
                    onClick={() => setOpen(false)}
                    className={`block rounded-sm px-2 py-2 text-sm ${
                      !currentType
                        ? "bg-dq-surface font-medium text-dq-gold"
                        : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                    }`}
                  >
                    {labels.all}
                  </Link>
                </li>
                {contentTypes.map((ct) => (
                  <li key={ct}>
                    <Link
                      href={buildUrl({ type: ct, page: undefined })}
                      onClick={() => setOpen(false)}
                      className={`block rounded-sm px-2 py-2 text-sm ${
                        currentType === ct
                          ? "bg-dq-surface font-medium text-dq-gold"
                          : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                      }`}
                    >
                      {typeNames[ct] ?? ct}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
