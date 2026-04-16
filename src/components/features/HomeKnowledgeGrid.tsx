// F-9: Home page 分割 — Newest / Popular グリッドセクション
import { Link } from "@/i18n/navigation";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import AnimateOnScroll from "@/components/ui/AnimateOnScroll";
import type { useTranslations } from "next-intl";
import type { KnowledgeCardRow } from "@/lib/knowledge/queries";

type TranslationsHome = ReturnType<typeof useTranslations<"Home">>;
type TranslationsCommon = ReturnType<typeof useTranslations<"Common">>;

interface HomeKnowledgeGridProps {
  tHome: TranslationsHome;
  tCommon: TranslationsCommon;
  items: KnowledgeCardRow[];
  /** セクション見出し */
  title: string;
  /** 「すべて見る」リンクの href */
  viewAllHref: string;
  /** アイテムが空の時の表示 (省略時は非表示) */
  showEmpty?: boolean;
}

export function HomeKnowledgeGrid({
  tHome,
  tCommon,
  items,
  title,
  viewAllHref,
  showEmpty = false,
}: HomeKnowledgeGridProps) {
  return (
    <section>
      <AnimateOnScroll animation="fade-up">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-1 items-center gap-4">
            <h2 className="shrink-0 font-display text-xl font-bold text-dq-gold">
              {title}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-dq-border to-transparent" />
          </div>
          <Link
            href={viewAllHref}
            className="group ml-4 text-sm text-dq-cyan hover:text-dq-gold"
          >
            {tCommon("viewAll")}{" "}
            <span className="inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </AnimateOnScroll>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <AnimateOnScroll key={item.id} animation="fade-up" delay={i * 80}>
            <KnowledgeCard
              id={item.id}
              listing_type={item.listing_type}
              title={item.title}
              description={item.description}
              content_type={item.content_type}
              price_sol={item.price_sol}
              seller={item.seller ?? { display_name: null }}
              category={item.category}
              tags={item.tags}
              average_rating={item.average_rating}
              purchase_count={item.purchase_count}
            />
          </AnimateOnScroll>
        ))}
      </div>
      {showEmpty && items.length === 0 && (
        <div className="py-12 text-center">
          <svg
            aria-hidden="true"
            className="mx-auto mb-3 h-10 w-10 text-dq-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.75 7.5h16.5"
            />
          </svg>
          <p className="text-dq-text-muted">{tHome("noItemsYet")}</p>
        </div>
      )}
    </section>
  );
}
