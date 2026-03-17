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
      founder: {
        "@type": "Person",
        name: "Soichiro Okumura",
        jobTitle: "Software Engineer",
        worksFor: { "@type": "Organization", "@id": "https://knowmint.shop/#organization" },
        knowsAbout: [
          "AI Agent Commerce",
          "Solana Blockchain Development",
          "Model Context Protocol",
          "x402 Protocol",
          "Next.js",
          "TypeScript",
        ],
        sameAs: [
          "https://www.linkedin.com/in/souokumura/",
          "https://github.com/Sou0327",
          "https://x.com/gensou_ongaku",
        ],
      },
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={aboutJsonLd} />

      {/* Hero */}
      <div className="dq-window p-6 sm:p-8 mb-12 text-center">
        <h1 className="text-3xl font-bold font-display text-dq-gold mb-3">
          {t("title")}
        </h1>
        <p className="text-dq-text-sub leading-relaxed max-w-xl mx-auto">
          {t("whatBody")}
        </p>
        <p className="mt-2 text-sm text-dq-text-muted">{t("lastUpdated")}</p>
      </div>

      <div className="space-y-10 text-dq-text-sub">
        {/* Mission */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("missionTitle")}
          </h2>
          <p className="leading-relaxed">{t("missionBody")}</p>
        </section>

        {/* Story */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("storyTitle")}
          </h2>
          <p className="leading-relaxed">{t("storyBody1")}</p>
          <p className="mt-3 leading-relaxed">{t("storyBody2")}</p>
        </section>

        {/* Team / Founder */}
        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("teamTitle")}
          </h2>
          <p className="leading-relaxed">{t("teamBody")}</p>

          <div className="mt-6 dq-window-sm p-5">
            <p className="text-lg font-semibold text-dq-gold">{t("founderName")}</p>
            <p className="text-sm text-dq-text-sub mt-1">{t("founderRole")}</p>
            <div className="mt-4 flex gap-4">
              <a
                href="https://www.linkedin.com/in/souokumura/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("founderLinkedinLabel")}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-sm border border-dq-border text-dq-cyan hover:text-dq-gold hover:border-dq-gold transition-colors"
              >
                {t("founderLinkedin")}
              </a>
              <a
                href="https://github.com/Sou0327"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("founderGithubLabel")}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-sm border border-dq-border text-dq-cyan hover:text-dq-gold hover:border-dq-gold transition-colors"
              >
                {t("founderGithub")}
              </a>
            </div>
          </div>
        </section>

        {/* Why Solana / x402 / MCP — grouped */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-dq-gold">
            {t("whySolanaTitle")}
          </h2>
          <p className="leading-relaxed">{t("whySolanaBody")}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-dq-gold">
            {t("whyX402Title")}
          </h2>
          <p className="leading-relaxed">{t("whyX402Body")}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-dq-gold">
            {t("whyMcpTitle")}
          </h2>
          <p className="leading-relaxed">{t("whyMcpBody")}</p>
        </section>

        {/* Tech Stack — card grid */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-dq-gold">
            {t("techTitle")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["techStack1", "techStack2", "techStack3", "techStack4", "techStack5"] as const).map((key) => (
              <div key={key} className="dq-window-sm px-4 py-3 text-sm">
                {t(key)}
              </div>
            ))}
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-dq-gold">
            {t("valuesTitle")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {([
              { title: "value1Title", body: "value1Body" },
              { title: "value2Title", body: "value2Body" },
              { title: "value3Title", body: "value3Body" },
              { title: "value4Title", body: "value4Body" },
            ] as const).map(({ title, body }) => (
              <div key={title} className="rounded-sm dq-window-sm p-4">
                <h3 className="mb-2 text-base font-semibold text-dq-cyan">
                  {t(title)}
                </h3>
                <p className="text-sm leading-relaxed">
                  {t(body)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section>
          <h2 className="mb-4 text-xl font-semibold text-dq-gold">
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

        {/* Open Source CTA */}
        <section className="dq-window p-6 sm:p-8 text-center">
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("openSourceTitle")}
          </h2>
          <p className="leading-relaxed mb-5">{t("openSourceBody")}</p>
          <a
            href="https://github.com/Sou0327/knowmint"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-sm border-2 border-dq-gold text-dq-gold hover:bg-dq-gold/10 transition-colors"
          >
            {t("openSourceLink")} →
          </a>
        </section>
      </div>
    </div>
  );
}
