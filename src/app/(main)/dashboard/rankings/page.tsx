import { getTopSellers } from "@/lib/rankings/queries";
import { getTranslations } from "next-intl/server";
import SellerRankingCard from "@/components/features/SellerRankingCard";

export const dynamic = "force-dynamic";

export default async function DashboardRankingsPage() {
  const [topSellers, t] = await Promise.all([
    getTopSellers(20),
    getTranslations("Rankings"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold font-display text-dq-text">
        {t("title")}
      </h1>
      <p className="mb-8 text-sm text-dq-text-muted">
        {t("description")}
      </p>

      {topSellers.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-dq-text-muted">
            {t("noData")}
          </p>
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
