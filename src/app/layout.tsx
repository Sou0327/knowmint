import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SolanaWalletProvider } from "@/contexts/WalletContext";
import { ChainProvider } from "@/contexts/ChainContext";
import { I18nProvider } from "@/contexts/I18nContext";
import type { Locale } from "@/lib/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const METADATA_BY_LOCALE: Record<Locale, { title: string; description: string }> = {
  ja: {
    title: "Knowledge Market - 知識売買マーケットプレイス",
    description: "専門知識・ノウハウを売買できるプラットフォーム",
  },
  en: {
    title: "Knowledge Market - Knowledge Marketplace",
    description: "A platform to buy and sell expertise and know-how",
  },
};

export function generateMetadata(): Metadata {
  return METADATA_BY_LOCALE.ja;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider initialLocale="ja">
          <AuthProvider>
            <SolanaWalletProvider>
              <ChainProvider>{children}</ChainProvider>
            </SolanaWalletProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
