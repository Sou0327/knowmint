import KnowledgeCard from "@/components/features/KnowledgeCard";
import type { ContentType, ListingType } from "@/types/database.types";

export interface SupabaseKnowledgeRow {
  id: string;
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  price_sol: number | null;
  price_usdc: number | null;
  tags: string[];
  average_rating: number | null;
  purchase_count: number;
  seller:
    | { display_name: string | null }
    | { display_name: string | null }[];
  category:
    | { name: string }
    | { name: string }[]
    | null;
}

interface RecommendationSectionProps {
  title: string;
  items: SupabaseKnowledgeRow[];
}

function normalizeSeller(
  seller: SupabaseKnowledgeRow["seller"]
): { display_name: string | null } {
  return Array.isArray(seller) ? seller[0] ?? { display_name: null } : seller;
}

function normalizeCategory(
  category: SupabaseKnowledgeRow["category"]
): { name: string } | null {
  if (!category) return null;
  return Array.isArray(category) ? category[0] ?? null : category;
}

export default function RecommendationSection({
  title,
  items,
}: RecommendationSectionProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label={title}>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="shrink-0 text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        <div
          className="h-px flex-1 bg-gradient-to-r from-zinc-200 to-transparent dark:from-zinc-700"
          aria-hidden="true"
        />
      </div>
      <div
        className="relative -mx-1 flex gap-4 overflow-x-auto px-1 pb-4 scrollbar-thin"
        role="list"
        aria-label={`${title}の一覧`}
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
              seller={normalizeSeller(item.seller)}
              category={normalizeCategory(item.category)}
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
