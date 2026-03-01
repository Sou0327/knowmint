"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { requestWalletChallenge, verifyWalletSignature } from "@/app/actions/wallet";
import { useTranslations } from "next-intl";

interface WalletButtonProps {
  showTabs?: boolean;
}

export default function WalletButton({ showTabs: _showTabs = false }: WalletButtonProps) {
  const t = useTranslations("Wallet");
  const { connected, publicKey, disconnect, connecting, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const { profile, refreshProfile, loading: authLoading } = useAuth();

  const [siwsError, setSiwsError] = useState<string | null>(null);
  const [siwsPending, setSiwsPending] = useState(false);
  const siwsRunning = useRef(false);

  useEffect(() => {
    if (
      authLoading ||
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
          setSiwsError(t("signCancelled"));
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
      setSiwsError(t("registrationError"));
      setSiwsPending(false);
      siwsRunning.current = false;
    });
  }, [authLoading, connected, publicKey, signMessage, profile?.wallet_address, refreshProfile]);

  useEffect(() => {
    if (!connected) {
      setSiwsError(null);
      siwsRunning.current = false;
    }
  }, [connected]);

  if (connected && publicKey) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-dq-text-sub">
            {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
          </span>
          {siwsPending && (
            <span className="text-xs text-dq-cyan">{t("signingPending")}</span>
          )}
          <Button variant="outline" size="sm" onClick={() => disconnect()}>
            {t("disconnect")}
          </Button>
        </div>
        {siwsError && (
          <p className="text-xs text-dq-red">{siwsError}</p>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={() => setVisible(true)}
      loading={connecting}
    >
      {t("connect")}
    </Button>
  );
}
