import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { BadgeProps } from "@/components/ui/Badge";
import { getTranslations } from "next-intl/server";
import { getContentDisplayLabel, getListingTypeLabel } from "@/types/knowledge.types";
import { getCategoryDisplayName } from "@/lib/i18n/category";
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
  category: { name: string; slug: string } | null;
  tags: string[];
  average_rating: number | null;
  purchase_count: number;
}

export default async function KnowledgeCard({
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
  const t = await getTranslations("Knowledge");
  const tCommon = await getTranslations("Common");
  const tTypes = await getTranslations("Types");
  const listingType = listing_type || "offer";

  return (
    <Link href={`/knowledge/${id}`} className="group">
      <Card hover padding="md" className="h-full transition-all duration-300">
        <div className="flex h-full flex-col">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant={listingType === "request" ? "warning" : "success"}>
                {getListingTypeLabel(listingType, tTypes)}
              </Badge>
              <Badge variant={BADGE_VARIANT[content_type]}>
                {getContentDisplayLabel(content_type, tTypes)}
              </Badge>
            </div>
            {category && (
              <span className="text-xs text-dq-text-muted">
                {getCategoryDisplayName(tTypes, category.slug, category.name)}
              </span>
            )}
          </div>

          <h3 className="mb-1 line-clamp-2 text-base font-semibold font-display text-dq-text transition-colors group-hover:text-dq-gold">
            {title}
          </h3>

          <p className="mb-3 line-clamp-2 flex-1 text-sm text-dq-text-sub">
            {description}
          </p>

          {tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm bg-dq-cyan/10 px-2 py-0.5 text-xs text-dq-cyan border border-dq-cyan/20"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-dq-text-muted">+{tags.length - 3}</span>
              )}
            </div>
          )}

          <div className="mt-auto flex items-end justify-between border-t-2 border-dq-border pt-3">
            <div>
              <span className="mr-2 text-xs text-dq-text-muted">
                {listingType === "request" ? t("reward") : t("price")}
              </span>
              {price_sol !== null && (
                <span className="text-lg font-bold tracking-tight text-dq-gold">
                  {price_sol} <span className="text-sm font-semibold">SOL</span>
                </span>
              )}
              {price_usdc !== null && price_sol !== null && (
                <span className="mx-1 text-dq-text-muted">/</span>
              )}
              {price_usdc !== null && (
                <span className="text-sm text-dq-text-sub">
                  {price_usdc} USDC
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-dq-text-muted">
              {average_rating !== null && (
                <span><span className="font-semibold text-dq-gold">★</span> {average_rating.toFixed(1)}</span>
              )}
              <span>
                {listingType === "request" ? t("reactionCount", { count: purchase_count }) : t("purchaseCount", { count: purchase_count })}
              </span>
            </div>
          </div>

          <p className="mt-2 text-xs text-dq-text-muted">
            {seller.display_name || tCommon("anonymous")}
          </p>
        </div>
      </Card>
    </Link>
  );
}
