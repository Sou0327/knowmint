"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Button from "@/components/ui/Button";
import { useChain } from "@/contexts/ChainContext";
import EVMWalletButton from "./EVMWalletButton";

interface WalletButtonProps {
  showTabs?: boolean;
}

export default function WalletButton({ showTabs = false }: WalletButtonProps) {
  const { connected, publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { selectedChain, setSelectedChain } = useChain();

  // Solana wallet display
  const solanaWallet = connected && publicKey ? (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
      </span>
      <Button variant="outline" size="sm" onClick={() => disconnect()}>
        切断
      </Button>
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
