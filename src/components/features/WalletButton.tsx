"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useChain } from "@/contexts/ChainContext";
import { useAuth } from "@/contexts/AuthContext";
import EVMWalletButton from "./EVMWalletButton";
import { requestWalletChallenge, verifyWalletSignature } from "@/app/actions/wallet";

interface WalletButtonProps {
  showTabs?: boolean;
}

export default function WalletButton({ showTabs = false }: WalletButtonProps) {
  const { connected, publicKey, disconnect, connecting, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const { selectedChain, setSelectedChain } = useChain();
  const { profile, refreshProfile } = useAuth();

  const [siwsError, setSiwsError] = useState<string | null>(null);
  const [siwsPending, setSiwsPending] = useState(false);
  const siwsRunning = useRef(false);

  useEffect(() => {
    if (
      selectedChain !== "solana" ||
      !connected ||
      !publicKey ||
      !signMessage ||
      profile?.wallet_address ||
      siwsRunning.current
    ) {
      return;
    }

    const runSiws = async () => {
      siwsRunning.current = true;
      setSiwsPending(true);
      setSiwsError(null);

      try {
        const walletStr = publicKey.toBase58();
        const challengeResult = await requestWalletChallenge(walletStr);
        if (!challengeResult.success) {
          setSiwsError(challengeResult.error);
          return;
        }

        const { nonce, message } = challengeResult;
        const messageBytes = new TextEncoder().encode(message);
        let signatureBytes: Uint8Array;
        try {
          signatureBytes = await signMessage(messageBytes);
        } catch {
          setSiwsError("署名がキャンセルされました");
          return;
        }

        const signatureBase64 = btoa(
          Array.from(signatureBytes, (b) => String.fromCharCode(b)).join("")
        );

        const verifyResult = await verifyWalletSignature(walletStr, signatureBase64, nonce);
        if (!verifyResult.success) {
          setSiwsError(verifyResult.error);
          return;
        }

        await refreshProfile();
        setSiwsError(null);
      } finally {
        setSiwsPending(false);
        siwsRunning.current = false;
      }
    };

    runSiws().catch((err: unknown) => {
      console.error("[WalletButton] SIWS flow failed:", err);
      setSiwsError("ウォレット登録中にエラーが発生しました");
      setSiwsPending(false);
      siwsRunning.current = false;
    });
  }, [connected, publicKey, signMessage, selectedChain, profile?.wallet_address, refreshProfile]);

  useEffect(() => {
    if (!connected) {
      setSiwsError(null);
      siwsRunning.current = false;
    }
  }, [connected]);

  const solanaWallet = connected && publicKey ? (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-dq-text-sub">
          {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </span>
        {siwsPending && (
          <span className="text-xs text-dq-cyan">署名確認中...</span>
        )}
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          切断
        </Button>
      </div>
      {siwsError && (
        <p className="text-xs text-dq-red">{siwsError}</p>
      )}
    </div>
  ) : (
    <Button
      variant="primary"
      size="sm"
      onClick={() => setVisible(true)}
      loading={connecting}
    >
      ウォレット接続
    </Button>
  );

  if (!showTabs) {
    return selectedChain === "solana" ? solanaWallet : <EVMWalletButton />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 border-b-2 border-dq-border">
        <button
          type="button"
          onClick={() => setSelectedChain("solana")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedChain === "solana"
              ? "border-b-2 border-dq-gold text-dq-gold"
              : "text-dq-text-muted hover:text-dq-text-sub"
          }`}
        >
          Solana
        </button>
        <button
          type="button"
          onClick={() => setSelectedChain("base")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedChain !== "solana"
              ? "border-b-2 border-dq-gold text-dq-gold"
              : "text-dq-text-muted hover:text-dq-text-sub"
          }`}
        >
          EVM
        </button>
      </div>
      {selectedChain === "solana" ? solanaWallet : <EVMWalletButton />}
    </div>
  );
}
