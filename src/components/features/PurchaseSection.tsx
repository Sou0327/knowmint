"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import PurchaseModal from "@/components/features/PurchaseModal";
import ShareCard from "@/components/features/ShareCard";
import { recordPurchase } from "@/app/actions/purchase";

interface Props {
  knowledgeId: string;
  title: string;
  priceSol: number | null;
  sellerWallet: string | null;
  isRequest: boolean;
}

export function PurchaseSection({
  knowledgeId,
  title,
  priceSol,
  sellerWallet,
  isRequest,
}: Props) {
  const t = useTranslations("Knowledge");
  const [isOpen, setIsOpen] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  const handlePurchaseComplete = async (
    txHash: string,
    chain: "solana",
    token: "SOL" | "USDC",
  ): Promise<void> => {
    const result = await recordPurchase(knowledgeId, txHash, chain, token, true);
    if (!result.success) {
      throw new Error(result.error ?? "Purchase failed");
    }
    setIsOpen(false);
    setShowShareCard(true);
  };

  // USDC 送金 UI は未実装なので、SOL 価格が無い (= USDC-only) listing は
  // 購入不可として disabled 表示にする。core/API は USDC 検証を持つが、
  // PurchaseModal が USDC 送金 transaction を構築できないため、modal を開いても
  // priceMissing エラーになるだけで意味がない。
  if (isRequest || !sellerWallet || priceSol === null) {
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
        sellerWallet={sellerWallet}
        onPurchaseComplete={handlePurchaseComplete}
      />
      {showShareCard && (
        <div className="mt-4">
          <ShareCard
            title={title}
            itemId={knowledgeId}
            onClose={() => setShowShareCard(false)}
          />
        </div>
      )}
    </>
  );
}
