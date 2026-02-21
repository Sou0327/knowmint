"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ChainType } from "@/types/wallet.types";

interface ChainContextType {
  selectedChain: ChainType;
  setSelectedChain: (chain: ChainType) => void;
}

const ChainContext = createContext<ChainContextType>({
  selectedChain: "solana",
  setSelectedChain: () => {},
});

export function ChainProvider({ children }: { children: ReactNode }) {
  const [selectedChain, setSelectedChain] = useState<ChainType>("solana");

  return (
    <ChainContext.Provider value={{ selectedChain, setSelectedChain }}>
      {children}
    </ChainContext.Provider>
  );
}

export function useChain() {
  return useContext(ChainContext);
}
