import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import { getKnowledgeByCategory } from "@/lib/knowledge/queries";
import type { ListingType } from "@/types/database.types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  if (!category) return {};
  const title = `${category.name}の知識`;
  return {
    title,
    description: `${category.name}カテゴリの知識一覧`,
    openGraph: { title, type: "website" },
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const page = parseInt(pageStr || "1", 10);

  const result = await getKnowledgeByCategory(slug, page);

  if (!result.category) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-dq-cyan hover:text-dq-gold"
        >
          ← トップ
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-dq-text">
          {result.category.name}
        </h1>
        <p className="text-sm text-dq-text-muted">
          {result.total} 件のアイテム
        </p>
      </div>

      {result.items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item: Record<string, unknown>) => (
            <KnowledgeCard
              key={item.id as string}
              id={item.id as string}
              listing_type={item.listing_type as ListingType}
              title={item.title as string}
              description={item.description as string}
              content_type={item.content_type as "prompt" | "tool_def" | "dataset" | "api" | "general"}
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
        <p className="py-12 text-center text-dq-text-muted">
          このカテゴリにはまだアイテムがありません
        </p>
      )}

      {/* Pagination */}
      {result.total_pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/category/${slug}?page=${page - 1}`}
              className="rounded-sm border border-dq-border px-4 py-2 text-sm hover:bg-dq-surface"
            >
              前へ
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-dq-text-sub">
            {page} / {result.total_pages}
          </span>
          {page < result.total_pages && (
            <Link
              href={`/category/${slug}?page=${page + 1}`}
              className="rounded-sm border border-dq-border px-4 py-2 text-sm hover:bg-dq-surface"
            >
              次へ
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
