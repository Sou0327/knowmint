"use client";

import { useState, useRef, useEffect } from "react";
import { useChain } from "@/contexts/ChainContext";
import { SUPPORTED_CHAINS } from "@/types/wallet.types";

export default function ChainSelector() {
  const { selectedChain, setSelectedChain } = useChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = SUPPORTED_CHAINS.find((c) => c.id === selectedChain) ?? SUPPORTED_CHAINS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-sm border-2 border-dq-border bg-dq-surface px-3 py-1.5 text-sm font-medium text-dq-text-sub transition-colors hover:border-dq-gold hover:text-dq-gold"
      >
        <span>{current.name}</span>
        <span className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-40 dq-window-sm py-1">
          {SUPPORTED_CHAINS.map((chain) => {
            const isSolana = chain.id === "solana";
            return (
              <button
                key={chain.id}
                type="button"
                disabled={!isSolana}
                onClick={() => { if (isSolana) { setSelectedChain(chain.id); setOpen(false); } }}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
                  !isSolana
                    ? "opacity-50 cursor-not-allowed text-dq-text-muted"
                    : chain.id === selectedChain
                      ? "bg-dq-surface text-dq-gold"
                      : "text-dq-text-sub hover:bg-dq-surface hover:text-dq-gold"
                }`}
              >
                <span>{isSolana && chain.id === selectedChain ? "▶ " : ""}{chain.name}</span>
                {!isSolana && (
                  <span className="text-[10px] font-medium text-dq-text-muted">Coming Soon</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
