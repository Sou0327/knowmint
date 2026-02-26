"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import PurchaseModal from "@/components/features/PurchaseModal";
import { recordPurchase } from "@/app/actions/purchase";
import type { Token } from "@/types/database.types";

interface Props {
  knowledgeId: string;
  title: string;
  priceSol: number | null;
  priceUsdc: number | null;
  sellerWallet: string | null;
  isRequest: boolean;
}

export function PurchaseSection({
  knowledgeId,
  title,
  priceSol,
  priceUsdc,
  sellerWallet,
  isRequest,
}: Props) {
  const t = useTranslations("Knowledge");
  const [isOpen, setIsOpen] = useState(false);

  // DB 記録完了後にモーダルを閉じる。失敗時は throw して PurchaseModal の setError で表示。
  const handlePurchaseComplete = async (
    txHash: string,
    chain: "solana" | "base" | "ethereum",
    token: Token
  ): Promise<void> => {
    const result = await recordPurchase(knowledgeId, txHash, chain, token, true);
    if (!result.success) {
      throw new Error(result.error ?? t("recordPurchaseFailed"));
    }
    setIsOpen(false);
  };

  if (isRequest || !sellerWallet) {
    return (
      <Button variant="secondary" size="lg" className="w-full" disabled>
        {isRequest ? t("recruitmentListing") : t("buy")}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        {t("buy")}
      </Button>
      <PurchaseModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        knowledgeId={knowledgeId}
        title={title}
        priceSol={priceSol}
        priceUsdc={priceUsdc}
        sellerWallet={sellerWallet}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </>
  );
}
