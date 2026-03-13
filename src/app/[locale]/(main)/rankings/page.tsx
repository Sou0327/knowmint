import type { Metadata } from "next";
import { getTopSellers, hasAnySellers } from "@/lib/rankings/queries";
import SellerRankingCard from "@/components/features/SellerRankingCard";
import { getTranslations, getLocale } from "next-intl/server";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";
import { JsonLd } from "@/components/seo/JsonLd";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const [t, { locale }, hasSellers] = await Promise.all([
    getTranslations("Rankings"),
    params,
    hasAnySellers(),
  ]);
  return {
    title: t("ogTitle"),
    description: t("ogDescription"),
    alternates: buildAlternates("/rankings", locale),
    openGraph: { ...ogDefaults(locale), title: `${t("ogTitle")} | KnowMint`, type: "website" },
    ...(!hasSellers ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function RankingsPage() {
  const [t, tCommon, locale, topSellers] = await Promise.all([
    getTranslations("Rankings"),
    getTranslations("Common"),
    getLocale(),
    getTopSellers(20),
  ]);
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tCommon("breadcrumbHome"), item: `https://knowmint.shop${localePrefix}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `https://knowmint.shop${localePrefix}/rankings` },
    ],
  };

  return (
    <div className="mx-auto max-w-2xl">
      <JsonLd data={breadcrumbJsonLd} />
      <h1 className="mb-2 text-2xl font-bold font-display text-dq-text">{t("title")}</h1>
      <p className="mb-8 text-sm text-dq-text-muted">
        {t("description")}
      </p>

      {topSellers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-dq-text-muted">{t("noData")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topSellers.map((seller, i) => (
            <SellerRankingCard key={seller.id} seller={seller} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
