import { getTranslations, getLocale } from "next-intl/server";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";
import { JsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [t, { locale }] = await Promise.all([
    getTranslations("About"),
    params,
  ]);
  return {
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates("/about", locale),
    openGraph: { ...ogDefaults(locale), title: t("ogTitle"), type: "website" },
  };
}

export default async function AboutPage() {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations("About"),
    getTranslations("Common"),
    getLocale(),
  ]);
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tCommon("breadcrumbHome"), item: `https://knowmint.shop${localePrefix}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `https://knowmint.shop${localePrefix}/about` },
    ],
  };

  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: t("title"),
    description: t("description"),
    url: `https://knowmint.shop${localePrefix}/about`,
    mainEntity: {
      "@type": "Organization",
      "@id": "https://knowmint.shop/#organization",
      name: "KnowMint",
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={aboutJsonLd} />

      <h1 className="mb-8 text-3xl font-bold font-display text-dq-gold">
        {t("title")}
      </h1>

      <div className="space-y-10 text-dq-text-sub">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("whatTitle")}
          </h2>
          <p className="leading-relaxed">{t("whatBody")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("missionTitle")}
          </h2>
          <p className="leading-relaxed">{t("missionBody")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("teamTitle")}
          </h2>
          <p className="leading-relaxed">{t("teamBody")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("techTitle")}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t("techStack1")}</li>
            <li>{t("techStack2")}</li>
            <li>{t("techStack3")}</li>
            <li>{t("techStack4")}</li>
            <li>{t("techStack5")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("openSourceTitle")}
          </h2>
          <p className="leading-relaxed">{t("openSourceBody")}</p>
          <a
            href="https://github.com/Sou0327/knowmint"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-dq-cyan hover:text-dq-gold transition-colors"
          >
            {t("openSourceLink")} →
          </a>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("storyTitle")}
          </h2>
          <p className="leading-relaxed">{t("storyBody1")}</p>
          <p className="mt-3 leading-relaxed">{t("storyBody2")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("whySolanaTitle")}
          </h2>
          <p className="leading-relaxed">{t("whySolanaBody")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("whyX402Title")}
          </h2>
          <p className="leading-relaxed">{t("whyX402Body")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("whyMcpTitle")}
          </h2>
          <p className="leading-relaxed">{t("whyMcpBody")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("valuesTitle")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <div key={n} className="rounded-sm dq-window-sm p-4">
                <h3 className="mb-2 text-base font-semibold text-dq-cyan">
                  {t(`value${n}Title` as Parameters<typeof t>[0])}
                </h3>
                <p className="text-sm leading-relaxed">
                  {t(`value${n}Body` as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("roadmapTitle")}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t("roadmapItem1")}</li>
            <li>{t("roadmapItem2")}</li>
            <li>{t("roadmapItem3")}</li>
            <li>{t("roadmapItem4")}</li>
            <li>{t("roadmapItem5")}</li>
            <li>{t("roadmapItem6")}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
