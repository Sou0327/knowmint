import type { Metadata } from "next";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import SearchBar from "@/components/features/SearchBar";
import { getPublishedKnowledge, getCategories } from "@/lib/knowledge/queries";
import Link from "next/link";
import type { ContentType, ListingType } from "@/types/database.types";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
import { CONTENT_TYPE_LABELS } from "@/types/knowledge.types";

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    type?: string;
    listing_type?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const t = await getTranslations("Search");
  const title = q ? `「${q}」` : t("title");
  return {
    title,
    robots: { index: false, follow: true },
  };
}

const SORT_OPTION_KEYS = [
  { value: "newest", key: "sortNewest" },
  { value: "popular", key: "sortPopular" },
  { value: "price_low", key: "sortPriceLow" },
  { value: "price_high", key: "sortPriceHigh" },
  { value: "rating", key: "sortTopRated" },
] as const;

export default async function SearchPage({ searchParams }: Props) {
  const [t] = await Promise.all([
    getTranslations("Search"),
  ]);

  const { q, category, type, listing_type, sort, page: pageStr } = await searchParams;
  const parsedPage = parseInt(pageStr || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.min(parsedPage, 1000) : 1;
  const sortBy = (sort || "newest") as "newest" | "popular" | "price_low" | "price_high" | "rating";

  const [result, categories] = await Promise.all([
    getPublishedKnowledge({
      query: q,
      category,
      content_type: type as ContentType | undefined,
      listing_type: listing_type as ListingType | undefined,
      sort_by: sortBy,
      page,
    }),
    getCategories(),
  ]);

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, category, type, sort, ...overrides };
    Object.entries(merged).forEach(([key, val]) => {
      if (val) params.set(key, val);
    });
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-dq-text">
          {q ? t("resultCount", { count: result.total }) : t("title")}
        </h1>
        <SearchBar defaultValue={q} className="max-w-xl" />
      </div>

      <div className="flex gap-8">
        {/* Filters sidebar */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <div className="sticky top-24 space-y-6">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dq-gold">
                カテゴリ
              </h3>
              <ul className="space-y-1">
                <li>
                  <Link
                    href={buildUrl({ category: undefined, page: undefined })}
                    className={`block rounded-sm px-2 py-1 text-sm ${
                      !category
                        ? "bg-dq-surface font-medium text-dq-gold"
                        : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                    }`}
                  >
                    {t("all")}
                  </Link>
                </li>
                {categories.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      href={buildUrl({ category: cat.slug, page: undefined })}
                      className={`block rounded-sm px-2 py-1 text-sm ${
                        category === cat.slug
                          ? "bg-dq-surface font-medium text-dq-gold"
                          : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                      }`}
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dq-gold">
                {t("contentType")}
              </h3>
              <ul className="space-y-1">
                <li>
                  <Link
                    href={buildUrl({ type: undefined, page: undefined })}
                    className={`block rounded-sm px-2 py-1 text-sm ${
                      !type
                        ? "bg-dq-surface font-medium text-dq-gold"
                        : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                    }`}
                  >
                    {t("all")}
                  </Link>
                </li>
                {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
                  <li key={value}>
                    <Link
                      href={buildUrl({ type: value, page: undefined })}
                      className={`block rounded-sm px-2 py-1 text-sm ${
                        type === value
                          ? "bg-dq-surface font-medium text-dq-gold"
                          : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                      }`}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          {/* Sort */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-dq-text-sub">
              {t("resultCount", { count: result.total })}
              {q && (
                <span className="font-normal text-dq-text-muted">
                  {" "}
                  - &quot;{q}&quot;
                </span>
              )}
            </p>
            <div className="flex gap-2">
              {SORT_OPTION_KEYS.map((opt) => (
                <Link
                  key={opt.value}
                  href={buildUrl({ sort: opt.value, page: undefined })}
                  className={`rounded-sm px-3 py-1 text-xs transition-all ${
                    sortBy === opt.value
                      ? "bg-dq-gold text-dq-bg"
                      : "bg-dq-surface text-dq-text-sub hover:bg-dq-hover"
                  }`}
                >
                  {t(opt.key)}
                </Link>
              ))}
            </div>
          </div>

          {result.data.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.data.map((item: Record<string, unknown>) => (
                <KnowledgeCard
                  key={item.id as string}
                  id={item.id as string}
                  listing_type={item.listing_type as ListingType}
                  title={item.title as string}
                  description={item.description as string}
                  content_type={item.content_type as ContentType}
                  price_sol={item.price_sol as number | null}
                  price_usdc={item.price_usdc as number | null}
                  seller={item.seller as { display_name: string | null }}
                  category={item.category as { name: string } | null}
                  tags={item.tags as string[]}
                  average_rating={item.average_rating as number | null}
                  purchase_count={item.purchase_count as number}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <svg
                className="mx-auto mb-4 h-12 w-12 text-dq-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-dq-text-muted">
                {t("noResults")}
              </p>
            </div>
          )}

          {/* Pagination */}
          {result.total_pages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="rounded-sm border-2 border-dq-border px-4 py-2 text-sm font-medium hover:bg-dq-surface transition-colors"
                >
                  {t("previous")}
                </Link>
              )}
              <span className="px-4 py-2 text-sm font-medium text-dq-text-sub">
                {page} / {result.total_pages}
              </span>
              {page < result.total_pages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="rounded-sm border-2 border-dq-border px-4 py-2 text-sm font-medium hover:bg-dq-surface transition-colors"
                >
                  {t("next")}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
