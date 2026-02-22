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
  // ref でフロー重複実行を防ぐ
  const siwsRunning = useRef(false);

  useEffect(() => {
    // Solana チェーン + ウォレット接続済み + wallet_address 未登録 + signMessage 利用可能
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

        // Step 1: チャレンジ取得
        const challengeResult = await requestWalletChallenge(walletStr);
        if (!challengeResult.success) {
          setSiwsError(challengeResult.error);
          return;
        }

        const { nonce, message } = challengeResult;

        // Step 2: ウォレットで署名
        const messageBytes = new TextEncoder().encode(message);
        let signatureBytes: Uint8Array;
        try {
          signatureBytes = await signMessage(messageBytes);
        } catch {
          setSiwsError("署名がキャンセルされました");
          return;
        }

        // Uint8Array → base64 (canonical, btoa でブラウザ安全変換)
        const signatureBase64 = btoa(
          Array.from(signatureBytes, (b) => String.fromCharCode(b)).join("")
        );

        // Step 3: 署名検証 + DB 保存 (consume_wallet_challenge RPC で原子的に更新)
        const verifyResult = await verifyWalletSignature(walletStr, signatureBase64, nonce);
        if (!verifyResult.success) {
          setSiwsError(verifyResult.error);
          return;
        }

        // Step 4: DB 更新済みのプロフィールを再取得してコンテキストに反映
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

  // ウォレット切断時にエラーをリセット
  useEffect(() => {
    if (!connected) {
      setSiwsError(null);
      siwsRunning.current = false;
    }
  }, [connected]);

  // Solana wallet display
  const solanaWallet = connected && publicKey ? (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </span>
        {siwsPending && (
          <span className="text-xs text-blue-500">署名確認中...</span>
        )}
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          切断
        </Button>
      </div>
      {siwsError && (
        <p className="text-xs text-red-500">{siwsError}</p>
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

  // Tab-based wallet selection
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setSelectedChain("solana")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedChain === "solana"
              ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Solana
        </button>
        <button
          type="button"
          onClick={() => setSelectedChain("base")}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedChain !== "solana"
              ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          EVM
        </button>
      </div>
      {selectedChain === "solana" ? solanaWallet : <EVMWalletButton />}
    </div>
  );
}
