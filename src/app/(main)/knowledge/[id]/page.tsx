import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCategoryDisplayName } from "@/lib/i18n/category";
import Badge from "@/components/ui/Badge";
import ContentPreview from "@/components/features/ContentPreview";
import { PurchaseSection } from "@/components/features/PurchaseSection";

export const dynamic = "force-dynamic";
import SellerCard from "@/components/features/SellerCard";
import ReviewList from "@/components/features/ReviewList";
import RecommendationSection from "@/components/features/RecommendationSection";
import { getKnowledgeById, getKnowledgeForMetadata } from "@/lib/knowledge/queries";
import { getRecommendations } from "@/lib/recommendations/queries";
import { getContentDisplayLabel, getListingTypeLabel } from "@/types/knowledge.types";
import { JsonLd } from "@/components/seo/JsonLd";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getKnowledgeForMetadata(id);
  if (!item) return {};
  const desc = item.description?.slice(0, 160) ?? "";
  return {
    title: item.title,
    description: desc,
    openGraph: {
      title: item.title,
      description: desc,
      type: "article",
      url: `/knowledge/${id}`,
      tags: item.tags as string[] | undefined,
    },
    twitter: { card: "summary_large_image", title: item.title, description: desc },
    alternates: { canonical: `/knowledge/${id}` },
  };
}

export default async function KnowledgeDetailPage({ params }: Props) {
  const { id } = await params;
  const [item, recommendations, t, tTypes] = await Promise.all([
    getKnowledgeById(id),
    getRecommendations(id),
    getTranslations("Knowledge"),
    getTranslations("Types"),
  ]);

  if (!item) {
    notFound();
  }

  const avgRating = item.average_rating
    ? Number(item.average_rating).toFixed(1)
    : null;
  const listingType = item.listing_type || "offer";
  const isRequest = listingType === "request";

  const rawSeller = item.seller ?? {
    id: "",
    display_name: null,
    avatar_url: null,
    bio: null,
    user_type: "human" as const,
    wallet_address: null,
  };
  const seller = { ...rawSeller, user_type: rawSeller.user_type as "human" | "agent" };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.title,
    description: item.description,
  };

  return (
    <div className="mx-auto max-w-4xl">
      <JsonLd data={productJsonLd} />
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-dq-cyan hover:text-dq-gold"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t("backToMarket")}
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={isRequest ? "warning" : "success"}>
                {getListingTypeLabel(listingType, tTypes)}
              </Badge>
              <Badge>{getContentDisplayLabel(item.content_type, tTypes)}</Badge>
              {item.category && (
                <Link
                  href={`/category/${item.category.slug}`}
                  className="text-sm text-dq-cyan hover:text-dq-gold"
                >
                  {getCategoryDisplayName(tTypes, item.category.slug, item.category.name)}
                </Link>
              )}
            </div>
            <h1 className="text-3xl font-bold font-display tracking-tight text-dq-text sm:text-4xl">
              {item.title}
            </h1>
            <div className="mt-2 flex items-center text-sm text-dq-text-muted">
              {avgRating && <span>★ {avgRating}</span>}
              <span className="before:content-['·'] before:mx-2 before:text-dq-text-muted">
                {isRequest ? t("reactionCount", { count: item.purchase_count }) : t("purchaseCount", { count: item.purchase_count })}
              </span>
              <span className="before:content-['·'] before:mx-2 before:text-dq-text-muted">
                {t("viewCount", { count: item.view_count })}
              </span>
            </div>
          </div>

          <div>
            <h2 className="mb-2 border-l-4 border-dq-gold pl-3 text-xl font-bold font-display text-dq-gold">
              {t("description")}
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed text-dq-text-sub">
              {item.description}
            </p>
          </div>

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="rounded-sm bg-dq-surface px-3 py-1 text-sm text-dq-cyan border border-dq-border transition-colors hover:bg-dq-hover hover:text-dq-gold"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {item.preview_content && (
            <div>
              <h2 className="mb-2 border-l-4 border-dq-gold pl-3 text-xl font-bold font-display text-dq-gold">
                {t("preview")}
              </h2>
              <ContentPreview
                contentType={item.content_type}
                content={item.preview_content}
              />
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="mb-4 border-l-4 border-dq-gold pl-3 text-xl font-bold text-dq-gold">
              {t("reviews")}
            </h2>
            <ReviewList reviews={item.reviews.map((r) => ({
              ...r,
              reviewer: r.reviewer ?? { id: "", display_name: null, avatar_url: null },
            }))} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Price card */}
          <div className="sticky top-24 space-y-4">
            <div className="overflow-hidden rounded-sm dq-window p-6">
              <div className="h-1 bg-dq-gold -mx-6 -mt-6 mb-6" />
              <div className="mb-4 space-y-1">
                <p className="text-xs font-medium tracking-wide text-dq-text-muted">
                  {isRequest ? t("rewardEstimate") : t("price")}
                </p>
                {item.price_sol !== null && (
                  <p className="text-2xl font-bold font-display text-dq-gold">
                    {item.price_sol} SOL
                  </p>
                )}
              </div>
              <PurchaseSection
                knowledgeId={item.id}
                title={item.title}
                priceSol={item.price_sol}
                sellerWallet={seller.wallet_address}
                isRequest={isRequest}
              />
            </div>

            {/* Seller */}
            <SellerCard seller={seller} heading={isRequest ? t("requester") : t("seller")} />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <RecommendationSection title={t("relatedItems")} items={recommendations} />
    </div>
  );
}
