import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { BadgeProps } from "@/components/ui/Badge";
import { CONTENT_TYPE_LABELS, LISTING_TYPE_LABELS } from "@/types/knowledge.types";
import type { ContentType, ListingType } from "@/types/database.types";

const BADGE_VARIANT: Record<ContentType, BadgeProps["variant"]> = {
  prompt: "info",
  tool_def: "success",
  dataset: "warning",
  api: "error",
  general: "default",
};

interface KnowledgeCardProps {
  id: string;
  listing_type: ListingType;
  title: string;
  description: string;
  content_type: ContentType;
  price_sol: number | null;
  price_usdc: number | null;
  seller: { display_name: string | null };
  category: { name: string } | null;
  tags: string[];
  average_rating: number | null;
  purchase_count: number;
}

export default function KnowledgeCard({
  id,
  listing_type,
  title,
  description,
  content_type,
  price_sol,
  price_usdc,
  seller,
  category,
  tags,
  average_rating,
  purchase_count,
}: KnowledgeCardProps) {
  const listingType = listing_type || "offer";

  return (
    <Link href={`/knowledge/${id}`} className="group">
      <Card hover padding="md" className="h-full transition-all duration-300 hover:shadow-md group-hover:border-blue-200 dark:group-hover:border-blue-800/50">
        <div className="flex h-full flex-col">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant={listingType === "request" ? "warning" : "success"}>
                {LISTING_TYPE_LABELS[listingType]}
              </Badge>
              <Badge variant={BADGE_VARIANT[content_type]}>
                {CONTENT_TYPE_LABELS[content_type]}
              </Badge>
            </div>
            {category && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {category.name}
              </span>
            )}
          </div>

          <h3 className="mb-1 line-clamp-2 text-base font-semibold text-zinc-900 transition-colors group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
            {title}
          </h3>

          <p className="mb-3 line-clamp-2 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>

          {tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-zinc-400">+{tags.length - 3}</span>
              )}
            </div>
          )}

          <div className="mt-auto flex items-end justify-between border-t border-zinc-200/60 pt-3 dark:border-zinc-800/60">
            <div>
              <span className="mr-2 text-xs text-zinc-500 dark:text-zinc-400">
                {listingType === "request" ? "報酬" : "価格"}
              </span>
              {price_sol !== null && (
                <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {price_sol} <span className="text-sm font-semibold">SOL</span>
                </span>
              )}
              {price_usdc !== null && price_sol !== null && (
                <span className="mx-1 text-zinc-400">/</span>
              )}
              {price_usdc !== null && (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {price_usdc} USDC
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              {average_rating !== null && (
                <span><span className="font-semibold text-amber-500">★</span> {average_rating.toFixed(1)}</span>
              )}
              <span>
                {purchase_count} {listingType === "request" ? "反応" : "購入"}
              </span>
            </div>
          </div>

          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {seller.display_name || "匿名"}
          </p>
        </div>
      </Card>
    </Link>
  );
}
