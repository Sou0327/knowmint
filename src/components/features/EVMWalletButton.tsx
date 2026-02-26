"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import Button from "@/components/ui/Button";
import { useChain } from "@/contexts/ChainContext";
import { useTranslations } from "next-intl";

const EVM_CHAIN_LABEL: Record<"base" | "ethereum", string> = {
  base: "Base",
  ethereum: "Ethereum",
};

export default function EVMWalletButton() {
  const t = useTranslations("Wallet");
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
        <span className="rounded-sm bg-dq-surface px-2 py-1 text-xs font-medium text-dq-text-sub border border-dq-border">
          {chainLabel}
        </span>
        <span className="rounded-sm bg-dq-surface px-3 py-1.5 font-mono text-xs text-dq-text-sub border border-dq-border">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          {t("disconnect")}
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
        {t("connectTo", { chain: chainLabel })}
      </Button>

      {openForChain === activeChain && connectors.length > 1 && (
        <div className="absolute right-0 z-50 mt-1 w-44 dq-window-sm py-1">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              onClick={() => {
                connect({ connector });
                setOpenForChain(null);
              }}
              className="flex w-full items-center px-3 py-2 text-left text-sm text-dq-text-sub transition-colors hover:bg-dq-surface hover:text-dq-gold"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
