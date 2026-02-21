"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import Button from "@/components/ui/Button";
import { useChain } from "@/contexts/ChainContext";

const EVM_CHAIN_LABEL: Record<"base" | "ethereum", string> = {
  base: "Base",
  ethereum: "Ethereum",
};

export default function EVMWalletButton() {
  const { selectedChain } = useChain();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [openForChain, setOpenForChain] = useState<"base" | "ethereum" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const activeChain = selectedChain === "ethereum" ? "ethereum" : "base";
  const chainLabel = EVM_CHAIN_LABEL[activeChain];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpenForChain(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {chainLabel}
        </span>
        <span className="rounded-lg bg-zinc-100 px-3 py-1.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          切断
        </Button>
      </div>
    );
  }

  const handleConnectClick = () => {
    if (connectors.length <= 1) {
      const connector = connectors[0];
      if (connector) connect({ connector });
      return;
    }

    setOpenForChain((prev) => (prev === activeChain ? null : activeChain));
  };

  return (
    <div ref={ref} className="relative">
      <Button
        variant="primary"
        size="sm"
        onClick={handleConnectClick}
        loading={isPending}
      >
        {chainLabel}に接続
      </Button>

      {openForChain === activeChain && connectors.length > 1 && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              onClick={() => {
                connect({ connector });
                setOpenForChain(null);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
