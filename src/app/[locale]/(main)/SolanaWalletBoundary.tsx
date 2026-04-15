"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// F-10: Solana ウォレット adapter (~300KB) を initial bundle から分離。
// `ssr: false` は Next.js 16 の Server Component 内では禁止のため、
// Client Component 境界 (このファイル) で dynamic を宣言する。
const SolanaWalletProvider = dynamic(
  () => import("@/contexts/WalletContext").then((m) => m.SolanaWalletProvider),
  { ssr: false },
);

export function SolanaWalletBoundary({ children }: { children: ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
