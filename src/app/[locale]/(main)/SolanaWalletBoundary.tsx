"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

type ProviderComponent = ComponentType<{ children: ReactNode }>;

/**
 * F-10: Solana ウォレット adapter (~300KB) を initial bundle から分離。
 *
 * 旧実装は `dynamic({ ssr: false })` で WalletProvider を wrap していたが、
 * Next.js 16 では ssr:false 化された component の children も SSR から除外
 * されるため、MainLayout 全体 (Header / main / Footer) が初期 HTML に含まれず
 * 空白 HTML が配信される (LCP/SEO 致命)。
 *
 * 修正: useEffect で client-only に WalletProvider を動的 import し、ロード
 * 完了までは children を素通し render する。これで SSR と hydration 初期値
 * は同じ `<>{children}</>` 構造になり mismatch せず、ユーザーは即座に UI を
 * 見られる。WalletProvider は CSR 後に追加で wrap され、wallet 依存 hook は
 * そのタイミングから利用可能になる。
 */
export function SolanaWalletBoundary({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<ProviderComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/contexts/WalletContext").then((m) => {
      if (!cancelled) {
        setProvider(() => m.SolanaWalletProvider);
      }
    }, () => {
      // Wallet adapter の読み込み失敗時は children を素通しのまま維持
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Provider) return <>{children}</>;
  return <Provider>{children}</Provider>;
}
