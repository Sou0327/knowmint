import dynamic from "next/dynamic";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// F-10: Solana ウォレット adapter (~300KB) を initial bundle から分離
// ssr: false で SSR 時に不要な Phantom/Solflare SDK を除外
const SolanaWalletProvider = dynamic(
  () => import("@/contexts/WalletContext").then((m) => m.SolanaWalletProvider),
  { ssr: false }
);

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SolanaWalletProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </SolanaWalletProvider>
  );
}
