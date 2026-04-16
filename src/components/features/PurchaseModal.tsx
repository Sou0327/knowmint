"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Link } from "@/i18n/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { buildSolTransfer } from "@/lib/solana/payment";
import { isSmartContractEnabled } from "@/lib/solana/program";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  knowledgeId: string;
  title: string;
  priceSol: number | null;
  sellerWallet: string;
  onPurchaseComplete: (
    txHash: string,
    chain: "solana",
    token: "SOL" | "USDC",
  ) => Promise<void>;
}

export default function PurchaseModal({
  isOpen,
  onClose,
  title,
  priceSol,
  sellerWallet,
  onPurchaseComplete,
}: Props) {
  const t = useTranslations("Purchase");
  const tCommon = useTranslations("Common");
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const amount = priceSol;

  const handlePurchase = async () => {
    if (!agreed) {
      setError(t("agreeToTerms"));
      return;
    }
    if (!amount || !sellerWallet) {
      setError(t("priceMissing"));
      return;
    }

    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { getConnection } = await import("@/lib/solana/connection");
      const connection = getConnection();

      let transaction;
      if (isSmartContractEnabled()) {
        const { buildSmartContractPurchase } = await import("@/lib/solana/program");
        transaction = await buildSmartContractPurchase(publicKey, sellerWallet, amount);
      } else {
        transaction = await buildSolTransfer(publicKey, sellerWallet, amount);
      }
      const signature = await sendTransaction(transaction, connection);
      // 現状はSOLのみサポート。USDC/EVM 対応時は引数を token state から伝播する。
      await onPurchaseComplete(signature, "solana", "SOL");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("paymentFailed"));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("confirmTitle")}
      size="md"
      disableClose={processing}
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm text-dq-text-muted">{t("item")}</p>
          <p className="font-medium text-dq-text">{title}</p>
        </div>

        {/* Price display */}
        <div>
          <p className="mb-2 text-sm font-medium text-dq-text-sub">
            {t("paymentToken")}
          </p>
          {priceSol !== null && (
            <div className="rounded-sm border-2 border-dq-gold bg-dq-gold/10 p-3 text-center">
              <span className="block text-lg font-bold text-dq-gold">
                {priceSol} SOL
              </span>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        {/* Terms */}
        <label
          htmlFor="terms-agree"
          className="flex cursor-pointer items-start gap-2.5 text-sm text-dq-text-sub"
        >
          <input
            id="terms-agree"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded-sm border-dq-border accent-dq-gold"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("termsAriaLabel")}
              className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
            >
              {t("termsLink")}
            </Link>
            {t("agreeTermsSuffix")}
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={processing}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handlePurchase}
            loading={processing}
            disabled={!agreed}
            className="flex-1"
          >
            {connected
              ? t("buyFor", { amount: amount ?? 0, token: "SOL" })
              : t("connectWallet")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
