import KnowledgeCard from "@/components/features/KnowledgeCard";
import type { RecommendationRow } from "@/lib/recommendations/queries";

interface RecommendationSectionProps {
  title: string;
  items: RecommendationRow[];
}

export default function RecommendationSection({
  title,
  items,
}: RecommendationSectionProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="shrink-0 text-xl font-bold font-display text-dq-gold">
          {title}
        </h2>
        <div
          className="h-px flex-1 bg-dq-border"
          aria-hidden="true"
        />
      </div>
      <div
        className="relative -mx-1 flex gap-4 overflow-x-auto px-1 pb-4 pt-2 scrollbar-thin"
        role="list"
        aria-label={title}
      >
        {items.map((item) => (
          <div key={item.id} className="w-72 shrink-0" role="listitem">
            <KnowledgeCard
              id={item.id}
              listing_type={item.listing_type}
              title={item.title}
              description={item.description}
              content_type={item.content_type}
              price_sol={item.price_sol}
              price_usdc={item.price_usdc}
              seller={item.seller ?? { display_name: null }}
              category={item.category}
              tags={item.tags}
              average_rating={item.average_rating}
              purchase_count={item.purchase_count}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
