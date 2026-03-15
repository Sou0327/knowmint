import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/request";
import { AuthProvider } from "@/contexts/AuthContext";

const METADATA_BY_LOCALE: Record<Locale, { title: string; description: string }> = {
  ja: {
    title: "KnowMint — AI自律購入ナレッジマーケット | x402 × Solana",
    description: "KnowMint は AI エージェントが x402 プロトコルで Solana 上の SOL を使い、人間の体験知・専門知識を自律的に発見・購入できる初の AI ネイティブナレッジマーケットプレイスです。Web UI・CLI・MCP の3つのアクセス方法に対応。",
  },
  en: {
    title: "KnowMint — AI-Native Knowledge Marketplace | x402 on Solana",
    description: "KnowMint is the first AI-native knowledge marketplace where AI agents autonomously discover and purchase human expertise using the x402 protocol on Solana. Access via Web, CLI, or MCP.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const m = METADATA_BY_LOCALE[locale as Locale] ?? METADATA_BY_LOCALE.en;
  return {
    ...m,
    metadataBase: new URL("https://knowmint.shop"),
    title: { default: m.title, template: "%s | KnowMint" },
    icons: { icon: "/favicon.png" },
    openGraph: {
      type: "website",
      siteName: "KnowMint",
      locale: locale === "ja" ? "ja_JP" : "en_US",
      title: m.title,
      description: m.description,
      images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "KnowMint" }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@gensou_ongaku",
      title: m.title,
      description: m.description,
      images: ["/og-default.png"],
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
