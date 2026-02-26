import type { Metadata } from "next";
import { getTopSellers } from "@/lib/rankings/queries";
import SellerRankingCard from "@/components/features/SellerRankingCard";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "出品者ランキング",
  description: "KnowMint で販売実績の多い出品者をランキング表示",
  openGraph: { title: "出品者ランキング | KnowMint", type: "website" },
};

export default async function RankingsPage() {
  const t = await getTranslations("Rankings");
  const topSellers = await getTopSellers(20);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold text-dq-text">{t("title")}</h1>
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
