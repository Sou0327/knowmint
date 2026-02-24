import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getFavorites } from "@/lib/favorites/queries";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import Card from "@/components/ui/Card";
import Link from "next/link";
import type { ContentType, ListingType } from "@/types/database.types";

interface FavoriteKnowledgeItem {
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
  seller: { display_name: string | null } | { display_name: string | null }[];
  category: { name: string } | { name: string }[] | null;
}

interface FavoriteRow {
  id: string;
  knowledge_item: FavoriteKnowledgeItem | FavoriteKnowledgeItem[] | null;
}

function normalizeItem(
  raw: FavoriteKnowledgeItem | FavoriteKnowledgeItem[] | null
): FavoriteKnowledgeItem | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function normalizeSeller(
  seller: FavoriteKnowledgeItem["seller"]
): { display_name: string | null } {
  return Array.isArray(seller) ? seller[0] ?? { display_name: null } : seller;
}

function normalizeCategory(
  category: FavoriteKnowledgeItem["category"]
): { name: string } | null {
  if (!category) return null;
  return Array.isArray(category) ? category[0] ?? null : category;
}

export const dynamic = "force-dynamic";

export default async function DashboardFavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const favorites = (await getFavorites(user.id)) as unknown as FavoriteRow[];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold text-dq-text">
        お気に入り
      </h1>

      {favorites.length === 0 ? (
        <Card padding="lg" className="mx-auto max-w-md text-center">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-dq-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
          <p className="mb-1 text-base font-medium text-dq-text-sub">
            お気に入りがありません
          </p>
          <p className="mb-4 text-sm text-dq-text-muted">
            気になるナレッジをお気に入りに追加してみましょう
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm font-medium text-dq-cyan transition-colors hover:text-dq-gold"
          >
            マーケットを見る
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((fav) => {
            const item = normalizeItem(fav.knowledge_item);
            if (!item) return null;
            return (
              <KnowledgeCard
                key={fav.id}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
