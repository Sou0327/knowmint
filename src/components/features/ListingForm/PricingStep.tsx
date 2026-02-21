"use client";

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
  const isRequest = listingType === "request";

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {isRequest
          ? "SOLまたはUSDC（もしくは両方）の希望報酬を設定してください。少なくとも1つは必須です。"
          : "SOLまたはUSDC（もしくは両方）の価格を設定してください。少なくとも1つは必須です。"}
      </p>

      <Input
        label={isRequest ? "希望報酬 (SOL)" : "価格 (SOL)"}
        type="number"
        value={priceSol}
        onChange={(e) => onPriceSolChange(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.001"
        error={errors.price_sol}
        hint={isRequest ? "Solana (SOL) での希望報酬" : "Solana (SOL) での価格"}
      />

      <Input
        label={isRequest ? "希望報酬 (USDC)" : "価格 (USDC)"}
        type="number"
        value={priceUsdc}
        onChange={(e) => onPriceUsdcChange(e.target.value)}
        placeholder="0.00"
        min="0"
        step="0.01"
        error={errors.price_usdc}
        hint={isRequest ? "USDC での希望報酬" : "USDC での価格"}
      />

      {!priceSol && !priceUsdc && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          {isRequest
            ? "少なくとも1つの希望報酬を設定してください"
            : "少なくとも1つの価格を設定してください"}
        </p>
      )}
    </div>
  );
}
