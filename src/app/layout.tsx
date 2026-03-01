import type { Metadata } from "next";
import { Geist, Geist_Mono, DotGothic16 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SolanaWalletProvider } from "@/contexts/WalletContext";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { Locale } from "@/i18n/request";

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dotgothic",
  display: "swap",
});

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
    title: "KnowMint - 知識売買マーケットプレイス",
    description: "専門知識・ノウハウを売買できるプラットフォーム",
  },
  en: {
    title: "KnowMint - Knowledge Marketplace",
    description: "A platform to buy and sell expertise and know-how",
  },
};

export function generateMetadata(): Metadata {
  const m = METADATA_BY_LOCALE.en;
  return {
    ...m,
    metadataBase: new URL("https://knowmint.shop"),
    title: { default: m.title, template: "%s | KnowMint" },
    openGraph: {
      type: "website",
      siteName: "KnowMint",
      locale: "en_US",
      title: m.title,
      description: m.description,
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "KnowMint" }],
    },
    twitter: {
      card: "summary_large_image",
      title: m.title,
      description: m.description,
      images: ["/og-default.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${dotGothic.variable} ${geistSans.variable} ${geistMono.variable}`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <SolanaWalletProvider>
              {children}
            </SolanaWalletProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
