import { notFound } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ContentPreview from "@/components/features/ContentPreview";

export const dynamic = "force-dynamic";
import SellerCard from "@/components/features/SellerCard";
import ReviewList from "@/components/features/ReviewList";
import RecommendationSection from "@/components/features/RecommendationSection";
import { getKnowledgeById } from "@/lib/knowledge/queries";
import { getRecommendations } from "@/lib/recommendations/queries";
import { CONTENT_TYPE_LABELS, LISTING_TYPE_LABELS } from "@/types/knowledge.types";
import type { ContentType, ListingType } from "@/types/database.types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function KnowledgeDetailPage({ params }: Props) {
  const { id } = await params;
  const [item, recommendations] = await Promise.all([
    getKnowledgeById(id),
    getRecommendations(id),
  ]);

  if (!item) {
    notFound();
  }

  const avgRating = item.average_rating
    ? Number(item.average_rating).toFixed(1)
    : null;
  const listingType = (item.listing_type as ListingType) || "offer";
  const isRequest = listingType === "request";

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        マーケットに戻る
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={isRequest ? "warning" : "success"}>
                {LISTING_TYPE_LABELS[listingType]}
              </Badge>
              <Badge>{CONTENT_TYPE_LABELS[item.content_type as ContentType]}</Badge>
              {item.category && (
                <Link
                  href={`/category/${(item.category as unknown as { slug: string }).slug}`}
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  {(item.category as unknown as { name: string }).name}
                </Link>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
              {item.title}
            </h1>
            <div className="mt-2 flex items-center text-sm text-zinc-500 dark:text-zinc-400">
              {avgRating && <span>★ {avgRating}</span>}
              <span className="before:content-['·'] before:mx-2 before:text-zinc-300 dark:before:text-zinc-600">
                {item.purchase_count} {isRequest ? "反応" : "購入"}
              </span>
              <span className="before:content-['·'] before:mx-2 before:text-zinc-300 dark:before:text-zinc-600">
                {item.view_count} 閲覧
              </span>
            </div>
          </div>

          <div>
            <h2 className="mb-2 border-l-4 border-blue-500 pl-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              説明
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">
              {item.description}
            </p>
          </div>

          {item.tags && (item.tags as string[]).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(item.tags as string[]).map((tag: string) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {item.preview_content && (
            <div>
              <h2 className="mb-2 border-l-4 border-blue-500 pl-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                プレビュー
              </h2>
              <ContentPreview
                contentType={item.content_type as ContentType}
                content={item.preview_content}
              />
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              レビュー
            </h2>
            <ReviewList reviews={(item.reviews as unknown as Array<{
              id: string;
              rating: number;
              comment: string | null;
              created_at: string;
              reviewer: {
                id: string;
                display_name: string | null;
                avatar_url: string | null;
              };
            }>) || []} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Price card */}
          <div className="sticky top-24 space-y-4">
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-violet-500" />
              <div className="mb-4 space-y-1">
                <p className="text-xs font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
                  {isRequest ? "想定報酬" : "価格"}
                </p>
                {item.price_sol !== null && (
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {item.price_sol} SOL
                  </p>
                )}
                {item.price_usdc !== null && (
                  <p className="text-lg text-zinc-600 dark:text-zinc-400">
                    {item.price_usdc} USDC
                  </p>
                )}
              </div>
              <Button
                variant={isRequest ? "secondary" : "primary"}
                size="lg"
                className="w-full"
                disabled={isRequest}
              >
                {isRequest ? "募集掲載（購入不可）" : "購入する"}
              </Button>
              <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
                {isRequest ? "この掲載は情報募集です" : "ウォレット接続が必要です"}
              </p>
            </div>

            {/* Seller */}
            <SellerCard seller={item.seller as unknown as {
              id: string;
              display_name: string | null;
              avatar_url: string | null;
              bio: string | null;
              user_type: "human" | "agent";
            }} heading={isRequest ? "依頼者" : "出品者"} />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <RecommendationSection title="関連アイテム" items={recommendations} />
    </div>
  );
}
