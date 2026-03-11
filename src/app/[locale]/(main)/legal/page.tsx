import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Legal");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("ogTitle"), type: "website" },
  };
}

export default async function LegalPage() {
  const t = await getTranslations("Legal");

  const LEGAL_ITEMS = [
    {
      label: t("label1"),
      value: t("value1"),
    },
    {
      label: t("label2"),
      value: t("value2"),
    },
    {
      label: t("label3"),
      value: t("value3"),
      isLink: true,
      href: "/contact",
      linkText: t("contactLinkText"),
    },
    {
      label: t("label4"),
      value: t("value4"),
    },
    {
      label: t("label4_5"),
      value: t("value4_5"),
    },
    {
      label: t("label5"),
      value: t("value5"),
    },
    {
      label: t("label6"),
      value: t("value6"),
    },
    {
      label: t("label7"),
      value: t("value7"),
    },
    {
      label: t("label8"),
      value: t("value8"),
    },
    {
      label: t("label9"),
      value: t("value9"),
      isLink: true,
      href: "/terms",
      linkText: t("termsLinkText"),
    },
    {
      label: t("label10"),
      value: t("value10"),
    },
    {
      label: t("label11"),
      value: t("value11"),
    },
    {
      label: t("label12"),
      value: t("value12"),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold font-display text-dq-gold">
        {t("title")}
      </h1>
      <p className="mb-8 text-sm text-dq-text-muted">
        {t("lastUpdated")}
      </p>

      <div className="font-legal overflow-hidden rounded-sm border border-dq-border">
        <dl className="divide-y divide-dq-border">
          {LEGAL_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:gap-4"
            >
              <dt className="w-full shrink-0 text-sm font-semibold text-dq-text-sub sm:w-44">
                {item.label}
              </dt>
              <dd className="text-sm leading-relaxed text-dq-text-sub">
                {item.isLink && item.href ? (
                  item.linkText ? (
                    <>
                      {item.value.split(item.linkText)[0]}
                      <a
                        href={item.href}
                        className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
                      >
                        {item.linkText}
                      </a>
                      {item.value.split(item.linkText)[1] ?? ""}
                    </>
                  ) : (
                    <a
                      href={item.href}
                      className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
                    >
                      {item.value}
                    </a>
                  )
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 rounded-sm bg-dq-yellow/10 p-4 text-sm text-dq-yellow">
        <p className="font-medium">{t("warningTitle")}</p>
        <p className="mt-1 leading-relaxed">
          {t("warningBody")}
        </p>
      </div>
    </div>
  );
}
