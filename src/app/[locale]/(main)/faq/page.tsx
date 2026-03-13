import { getTranslations, getLocale } from "next-intl/server";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [t, { locale }] = await Promise.all([
    getTranslations("FAQ"),
    params,
  ]);
  return {
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates("/faq", locale),
    openGraph: { ...ogDefaults(locale), title: t("ogTitle"), type: "website" },
  };
}

const FAQ_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;

export default async function FaqPage() {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("FAQ"),
    getTranslations("Common"),
    getLocale(),
  ]);
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const faqItems = FAQ_KEYS.map((n) => ({
    question: t(`q${n}`),
    answer: t(`a${n}`),
  }));

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "summary"],
    },
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tCommon("breadcrumbHome"), item: `https://knowmint.shop${localePrefix}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `https://knowmint.shop${localePrefix}/faq` },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={faqJsonLd} />

      <h1 className="mb-8 text-3xl font-bold font-display text-dq-gold">
        {t("title")}
      </h1>

      <div className="space-y-6">
        {faqItems.map((item, i) => (
          <details
            key={i}
            className="group dq-window overflow-hidden"
            open={i === 0}
          >
            <summary className="cursor-pointer px-6 py-4 text-lg font-semibold text-dq-text transition-colors hover:text-dq-gold">
              <span className="ml-1">{item.question}</span>
            </summary>
            <div className="border-t border-dq-border px-6 py-4 leading-relaxed text-dq-text-sub">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
