import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/request";
import { AuthProvider } from "@/contexts/AuthContext";
import { SolanaWalletProvider } from "@/contexts/WalletContext";

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
        <SolanaWalletProvider>
          {children}
        </SolanaWalletProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
