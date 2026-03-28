import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string>;
}

export default function AdminPagination({
  currentPage,
  totalPages,
  basePath,
  searchParams = {},
}: AdminPaginationProps) {
  const t = useTranslations("Admin");

  if (totalPages <= 1) return null;

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
      <p className="text-sm text-dq-text-muted tabular-nums">
        {t("page", { current: currentPage, total: totalPages })}
      </p>
      <div className="flex gap-2">
        {currentPage > 1 ? (
          <Link
            href={buildHref(currentPage - 1)}
            className="cursor-pointer rounded-sm border border-dq-border px-3 py-1.5 text-sm text-dq-text-sub hover:bg-dq-surface transition-colors focus:outline-none focus:ring-1 focus:ring-dq-gold/30"
            aria-label={`${t("previous")} page`}
          >
            {t("previous")}
          </Link>
        ) : (
          <span className="rounded-sm border border-dq-border px-3 py-1.5 text-sm text-dq-text-muted opacity-40 cursor-not-allowed">
            {t("previous")}
          </span>
        )}
        {currentPage < totalPages ? (
          <Link
            href={buildHref(currentPage + 1)}
            className="cursor-pointer rounded-sm border border-dq-border px-3 py-1.5 text-sm text-dq-text-sub hover:bg-dq-surface transition-colors focus:outline-none focus:ring-1 focus:ring-dq-gold/30"
            aria-label={`${t("next")} page`}
          >
            {t("next")}
          </Link>
        ) : (
          <span className="rounded-sm border border-dq-border px-3 py-1.5 text-sm text-dq-text-muted opacity-40 cursor-not-allowed">
            {t("next")}
          </span>
        )}
      </div>
    </nav>
  );
}
