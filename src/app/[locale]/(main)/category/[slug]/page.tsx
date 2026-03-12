import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import KnowledgeCard from "@/components/features/KnowledgeCard";
import { getKnowledgeByCategory } from "@/lib/knowledge/queries";
import { getTranslations } from "next-intl/server";
import { getCategoryDisplayName } from "@/lib/i18n/category";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";
import { JsonLd } from "@/components/seo/JsonLd";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("slug", slug)
    .maybeSingle<{ name: string }>();
  if (!category) return {};
  const [t, tTypes] = await Promise.all([
    getTranslations("Search"),
    getTranslations("Types"),
  ]);
  const displayName = getCategoryDisplayName(tTypes, slug, category.name);
  const title = t("categoryMetaTitle", { name: displayName });
  return {
    title,
    description: t("categoryMetaDescription", { name: displayName }),
    openGraph: { ...ogDefaults(locale), title, type: "website" },
    alternates: buildAlternates(`/category/${slug}`, locale),
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [t, tTypes, tCommon] = await Promise.all([
    getTranslations("Search"),
    getTranslations("Types"),
    getTranslations("Common"),
  ]);

  const { slug, locale } = await params;
  const { page: pageStr } = await searchParams;
  const rawPage = Number.parseInt(pageStr ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const initialResult = await getKnowledgeByCategory(slug, page);

  if (!initialResult.category) {
    notFound();
  }

  // Re-fetch last page when requested page exceeds total
  const effectivePage = initialResult.total_pages > 0 && page > initialResult.total_pages
    ? initialResult.total_pages
    : page;
  const result = effectivePage !== page
    ? await getKnowledgeByCategory(slug, effectivePage)
    : initialResult;

  const categoryName = result.category?.name ?? initialResult.category.name;
  const localePrefix = locale === "en" ? "" : `/${locale}`;
  const displayName = getCategoryDisplayName(tTypes, slug, categoryName);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: tCommon("breadcrumbHome"),
        item: `https://knowmint.shop${localePrefix}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: displayName,
        item: `https://knowmint.shop${localePrefix}/category/${slug}`,
      },
    ],
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: displayName,
    url: `https://knowmint.shop${localePrefix}/category/${slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: result.total,
      itemListElement: result.items.map((item, i) => ({
        "@type": "ListItem",
        position: (effectivePage - 1) * 12 + i + 1,
        url: `https://knowmint.shop${localePrefix}/knowledge/${item.id}`,
        name: item.title,
      })),
    },
  };

  return (
    <div>
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={collectionJsonLd} />
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-dq-cyan hover:text-dq-gold"
        >
          ← {t("backToTop")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold font-display text-dq-text">
          {displayName}
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
          {effectivePage > 1 && (
            <Link
              href={`/category/${slug}?page=${effectivePage - 1}`}
              className="rounded-sm border border-dq-border px-4 py-2 text-sm hover:bg-dq-surface"
            >
              {t("previous")}
            </Link>
          )}
          <span className="px-4 py-2 text-sm text-dq-text-sub">
            {effectivePage} / {result.total_pages}
          </span>
          {effectivePage < result.total_pages && (
            <Link
              href={`/category/${slug}?page=${effectivePage + 1}`}
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
