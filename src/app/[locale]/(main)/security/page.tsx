import { getTranslations, getLocale } from "next-intl/server";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [t, { locale }] = await Promise.all([
    getTranslations("Security"),
    params,
  ]);
  return {
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates("/security", locale),
    openGraph: { ...ogDefaults(locale), title: t("ogTitle"), type: "website" },
  };
}

export default async function SecurityPage() {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("Security"),
    getTranslations("Common"),
    getLocale(),
  ]);
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tCommon("breadcrumbHome"), item: `https://knowmint.shop${localePrefix}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `https://knowmint.shop${localePrefix}/security` },
    ],
  };

  const securityJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: t("title"),
    description: t("description"),
    url: `https://knowmint.shop${localePrefix}/security`,
  };

  const sections = [
    { title: "nonCustodialTitle", body: "nonCustodialBody" },
    { title: "apiKeysTitle", body: "apiKeysBody" },
    { title: "headersTitle", body: "headersBody" },
    { title: "authTitle", body: "authBody" },
    { title: "rateLimitTitle", body: "rateLimitBody" },
    { title: "dbTitle", body: "dbBody" },
    { title: "auditTitle", body: "auditBody" },
    { title: "disclosureTitle", body: "disclosureBody" },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={securityJsonLd} />

      <h1 className="mb-4 text-3xl font-bold font-display text-dq-gold">
        {t("title")}
      </h1>
      <p className="mb-10 text-lg text-dq-text-sub">{t("introBody")}</p>

      <div className="space-y-8 text-dq-text-sub">
        {sections.map((sec) => (
          <section key={sec.title}>
            <h2 className="mb-3 text-xl font-semibold text-dq-gold">
              {t(sec.title)}
            </h2>
            <p className="leading-relaxed">{t(sec.body)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
