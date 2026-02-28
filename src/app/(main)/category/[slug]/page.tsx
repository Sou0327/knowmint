import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import { getKnowledgeByCategory } from "@/lib/knowledge/queries";
import { getTranslations } from "next-intl/server";

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
    .maybeSingle<{ name: string }>();
  if (!category) return {};
  const t = await getTranslations("Search");
  const title = t("categoryMetaTitle", { name: category.name });
  return {
    title,
    description: t("categoryMetaDescription", { name: category.name }),
    openGraph: { title, type: "website" },
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const t = await getTranslations("Search");

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
          ← {t("backToTop")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold font-display text-dq-text">
          {result.category.name}
        </h1>
        <p className="text-sm text-dq-text-muted">
          {t("categoryItemCount", { count: result.total })}
        </p>
      </div>

      {result.items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <KnowledgeCard
              key={item.id}
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
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-dq-text-muted">
          {t("noCategoryItems")}
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
              {t("previous")}
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
              {t("next")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
