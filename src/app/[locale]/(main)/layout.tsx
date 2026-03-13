import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SolanaWalletProvider } from "@/contexts/WalletContext";

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
