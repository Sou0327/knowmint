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
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600"
      >
        <span>{current.name}</span>
        <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
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
                    ? "opacity-50 cursor-not-allowed text-zinc-400 dark:text-zinc-500"
                    : chain.id === selectedChain
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <span>{chain.name}</span>
                {!isSolana && (
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Coming Soon</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
