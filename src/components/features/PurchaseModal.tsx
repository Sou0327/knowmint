"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { buildSolTransfer, getPaymentAmount } from "@/lib/solana/payment";
import { isSmartContractEnabled } from "@/lib/solana/program";
import { useChain } from "@/contexts/ChainContext";
import type { Token } from "@/types/database.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  knowledgeId: string;
  title: string;
  priceSol: number | null;
  priceUsdc: number | null;
  sellerWallet: string;
  onPurchaseComplete: (txHash: string, chain: "solana" | "base" | "ethereum", token: Token) => Promise<void>;
}

export default function PurchaseModal({
  isOpen,
  onClose,
  title,
  priceSol,
  priceUsdc,
  sellerWallet,
  onPurchaseComplete,
}: Props) {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { selectedChain } = useChain();
  const [selectedToken, setSelectedToken] = useState<Token>(
    priceSol !== null ? "SOL" : "USDC"
  );
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const amount = getPaymentAmount(priceSol, priceUsdc, selectedToken);

  const handlePurchase = async () => {
    if (!agreed) {
      setError("利用規約に同意してください");
      return;
    }
    if (!amount || !sellerWallet) {
      setError("価格情報または出品者のウォレットアドレスが不足しています");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      if (selectedChain === "solana") {
        if (!connected || !publicKey) {
          setVisible(true);
          setProcessing(false);
          return;
        }

        const { getConnection } = await import("@/lib/solana/connection");
        const connection = getConnection();

        if (selectedToken === "SOL") {
          let transaction;
          if (isSmartContractEnabled()) {
            const { buildSmartContractPurchase } = await import("@/lib/solana/program");
            transaction = await buildSmartContractPurchase(publicKey, sellerWallet, amount);
          } else {
            transaction = await buildSolTransfer(publicKey, sellerWallet, amount);
          }
          const signature = await sendTransaction(transaction, connection);
          await onPurchaseComplete(signature, "solana", "SOL");
        } else {
          if (isSmartContractEnabled()) {
            const { buildSmartContractPurchaseSpl } = await import("@/lib/solana/program");
            const { resolveUsdcAccounts } = await import("@/lib/solana/token-accounts");
            const { buyerAta, sellerAta, feeVaultAta } = await resolveUsdcAccounts(publicKey, sellerWallet);
            const amountAtomic = BigInt(Math.round(amount * 1_000_000));
            const transaction = await buildSmartContractPurchaseSpl(
              publicKey, buyerAta, sellerAta, feeVaultAta, amountAtomic
            );
            const signature = await sendTransaction(transaction, connection);
            await onPurchaseComplete(signature, "solana", "USDC");
          } else {
            setError("USDC決済は現在準備中です");
          }
        }
      } else {
        if (!evmConnected || !evmAddress) {
          setError("EVMウォレットを接続してください");
          setProcessing(false);
          return;
        }

        const hash = await sendTransactionAsync({
          to: sellerWallet as `0x${string}`,
          value: parseEther(amount.toString()),
        });
        await onPurchaseComplete(hash, selectedChain as "base" | "ethereum", "ETH");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "決済に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="購入確認" size="md">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-dq-text-muted">購入アイテム</p>
          <p className="font-medium text-dq-text">{title}</p>
        </div>

        {/* Token selection */}
        <div>
          <p className="mb-2 text-sm font-medium text-dq-text-sub">
            支払い通貨
          </p>
          <div className="flex gap-2">
            {priceSol !== null && (
              <button
                type="button"
                onClick={() => setSelectedToken("SOL")}
                className={`flex-1 rounded-sm border-2 p-3 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-dq-gold ${
                  selectedToken === "SOL"
                    ? "border-dq-gold bg-dq-gold/10"
                    : "border-dq-border hover:border-dq-gold/50"
                }`}
              >
                <span className="block text-lg font-bold text-dq-gold">
                  {priceSol} SOL
                </span>
              </button>
            )}
            {priceUsdc !== null && (
              <button
                type="button"
                onClick={() => setSelectedToken("USDC")}
                className={`flex-1 rounded-sm border-2 p-3 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-dq-gold ${
                  selectedToken === "USDC"
                    ? "border-dq-gold bg-dq-gold/10"
                    : "border-dq-border hover:border-dq-gold/50"
                }`}
              >
                <span className="block text-lg font-bold text-dq-gold">
                  {priceUsdc} USDC
                </span>
              </button>
            )}
          </div>
        </div>

        {selectedChain !== "solana" && (
          <div className="rounded-sm border-2 border-dq-yellow/40 bg-dq-yellow/10 p-3 text-sm text-dq-yellow">
            EVM チェーンでの購入は現在準備中です（Solana をご利用ください）
          </div>
        )}

        {error && (
          <div className="rounded-sm border-2 border-dq-red/40 bg-dq-red/10 p-3 text-sm text-dq-red">
            {error}
          </div>
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
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Terms (opens in new tab)"
              className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
            >
              利用規約
            </a>
            に同意します
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={handlePurchase}
            loading={processing}
            disabled={selectedChain !== "solana" || !agreed}
            className="flex-1"
          >
            {connected
              ? `${amount} ${selectedToken} で購入`
              : "ウォレットを接続"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
