"use client";

import { useTranslations } from "next-intl";
import Input from "@/components/ui/Input";
import type { ListingType } from "@/types/database.types";

interface Props {
  listingType: ListingType;
  priceSol: string;
  priceUsdc: string;
  onPriceSolChange: (value: string) => void;
  onPriceUsdcChange: (value: string) => void;
  errors: Record<string, string>;
}

export default function PricingStep({
  listingType,
  priceSol,
  priceUsdc,
  onPriceSolChange,
  onPriceUsdcChange,
  errors,
}: Props) {
  const t = useTranslations("Listing");
  const isRequest = listingType === "request";

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {isRequest ? t("rewardNote") : t("priceNote")}
      </p>

      <Input
        label={isRequest ? t("rewardSol") : t("priceSol")}
        type="number"
        value={priceSol}
        onChange={(e) => onPriceSolChange(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.001"
        error={errors.price_sol}
        hint={isRequest ? t("rewardSolDesc") : t("priceSolDesc")}
      />

      <Input
        label={isRequest ? t("rewardUsdc") : t("priceUsdc")}
        type="number"
        value={priceUsdc}
        onChange={(e) => onPriceUsdcChange(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.01"
        error={errors.price_usdc}
        hint={isRequest ? t("rewardUsdcDesc") : t("priceUsdcDesc")}
      />

      {!priceSol && !priceUsdc && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          {isRequest ? t("rewardSetRequired") : t("priceSetRequired")}
        </p>
      )}
    </div>
  );
}
