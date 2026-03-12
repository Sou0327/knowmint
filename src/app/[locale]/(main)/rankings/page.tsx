import type { Metadata } from "next";
import { getTopSellers } from "@/lib/rankings/queries";
import SellerRankingCard from "@/components/features/SellerRankingCard";
import { getTranslations } from "next-intl/server";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const [t, { locale }] = await Promise.all([
    getTranslations("Rankings"),
    params,
  ]);
  return {
    title: t("ogTitle"),
    description: t("ogDescription"),
    alternates: buildAlternates("/rankings", locale),
    openGraph: { ...ogDefaults(locale), title: `${t("ogTitle")} | KnowMint`, type: "website" },
  };
}

export default async function RankingsPage() {
  const [t, topSellers] = await Promise.all([
    getTranslations("Rankings"),
    getTopSellers(20),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
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
