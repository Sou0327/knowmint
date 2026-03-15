import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { buildAlternates, ogDefaults } from "@/lib/seo/alternates";
import { JsonLd } from "@/components/seo/JsonLd";

const EMAIL = "contact@knowmint.shop";
const GITHUB_ISSUES = "https://github.com/Sou0327/knowmint/issues";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [t, { locale }] = await Promise.all([
    getTranslations("Contact"),
    params,
  ]);
  return {
    title: t("title"),
    description: t("description"),
    alternates: buildAlternates("/contact", locale),
    openGraph: { ...ogDefaults(locale), title: t("ogTitle"), type: "website" },
  };
}

export default async function ContactPage() {
  const [t, tFooter, tCommon, locale] = await Promise.all([
    getTranslations("Contact"),
    getTranslations("Footer"),
    getTranslations("Common"),
    getLocale(),
  ]);
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: tCommon("breadcrumbHome"), item: `https://knowmint.shop${localePrefix}` },
      { "@type": "ListItem", position: 2, name: t("title"), item: `https://knowmint.shop${localePrefix}/contact` },
    ],
  };

  const contactPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: t("title"),
    url: `https://knowmint.shop${localePrefix}/contact`,
    mainEntity: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "contact@knowmint.shop",
      availableLanguage: ["English", "Japanese"],
    },
  };

  const categories = [
    {
      title: t("techTitle"),
      description: t("techDescription"),
      action: t("techAction"),
      href: GITHUB_ISSUES,
      isExternal: true,
    },
    {
      title: t("contentTitle"),
      description: t("contentDescription"),
      action: t("contentAction"),
      href: `mailto:${EMAIL}`,
    },
    {
      title: t("legalTitle"),
      description: t("legalDescription"),
      action: t("legalAction"),
      href: `mailto:${EMAIL}`,
    },
    {
      title: t("bizTitle"),
      description: t("bizDescription"),
      action: t("bizAction"),
      href: `mailto:${EMAIL}`,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={contactPageJsonLd} />
      <h1 className="mb-2 text-3xl font-bold font-display text-dq-text">
        {t("title")}
      </h1>
      <p className="mb-8 text-sm text-dq-text-muted">{t("lastUpdated")}</p>

      <p className="mb-8 leading-relaxed text-dq-text-sub">{t("intro")}</p>

      <div className="mb-6 rounded-sm border border-dq-border bg-dq-window-bg p-4 text-center">
        <p className="mb-1 text-sm text-dq-text-sub">{t("emailLabel")}</p>
        <p className="font-mono text-lg text-dq-cyan select-all">{EMAIL}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((cat) => (
          <div
            key={cat.title}
            className="flex flex-col rounded-sm border border-dq-border bg-dq-window-bg p-5"
          >
            <h2 className="mb-2 text-base font-semibold text-dq-text">
              {cat.title}
            </h2>
            <p className="mb-4 flex-1 text-sm leading-relaxed text-dq-text-sub">
              {cat.description}
            </p>
            <a
              href={cat.href}
              target={cat.isExternal ? "_blank" : undefined}
              rel={cat.isExternal ? "noopener noreferrer" : undefined}
              className="inline-flex items-center justify-center gap-1.5 rounded-sm bg-dq-gold px-4 py-2 text-center text-sm font-medium text-dq-bg transition-colors hover:bg-dq-gold/80"
            >
              {cat.action}
              {cat.isExternal && (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              )}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-sm border border-dq-border bg-dq-surface p-5">
        <h2 className="mb-3 text-base font-semibold text-dq-text">
          {t("dpfTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-dq-text-sub">
          {t("dpfBody")}
        </p>
      </div>

      <div className="mt-6 text-center text-sm text-dq-text-muted">
        <p>
          {t("faqPrefix")}{" "}
          <Link
            href="/terms"
            className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
          >
            {tFooter("terms")}
          </Link>
          ・
          <Link
            href="/privacy"
            className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
          >
            {tFooter("privacy")}
          </Link>
          ・
          <Link
            href="/legal"
            className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
          >
            {tFooter("commercialLaw")}
          </Link>{" "}
          {t("faqSuffix")}
        </p>
      </div>
    </div>
  );
}
