import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Privacy");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("ogTitle"), type: "website" },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

  const tableRows: [string, string][] = [
    [t("sec1DataType1"), t("sec1Purpose1")],
    [t("sec1DataType2"), t("sec1Purpose2")],
    [t("sec1DataType3"), t("sec1Purpose3")],
    [t("sec1DataType4"), t("sec1Purpose4")],
    [t("sec1DataType5"), t("sec1Purpose5")],
    [t("sec1DataType6"), t("sec1Purpose6")],
    [t("sec1DataType7"), t("sec1Purpose7")],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold font-display text-dq-gold">
        {t("title")}
      </h1>
      <p className="mb-8 text-sm text-dq-text-muted">
        {t("lastUpdated")}
      </p>

      <div className="font-legal space-y-8 text-dq-text-sub">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("sec1Title")}
          </h2>
          <p className="mb-2 leading-relaxed">
            {t("sec1Intro")}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dq-border rounded-sm border border-dq-border text-sm">
              <thead className="bg-dq-surface">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-dq-text-sub">
                    {t("sec1TableHeaderType")}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium text-dq-text-sub">
                    {t("sec1TableHeaderPurpose")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dq-border bg-dq-window-bg">
                {tableRows.map(([type, purpose]) => (
                  <tr key={type}>
                    <td className="px-4 py-2.5 text-dq-text-sub">
                      {type}
                    </td>
                    <td className="px-4 py-2.5 text-dq-text-sub">
                      {purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("sec2Title")}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
            <li>{t("sec2Item1")}</li>
            <li>{t("sec2Item2")}</li>
            <li>{t("sec2Item3")}</li>
            <li>{t("sec2Item4")}</li>
            <li>{t("sec2Item5")}</li>
            <li>{t("sec2Item6")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("sec3Title")}
          </h2>
          <p className="leading-relaxed">
            {t("sec3Body")}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("sec4Title")}
          </h2>
          <p className="mb-2 leading-relaxed">
            {t("sec4Intro")}
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t("sec4Item1")}</li>
            <li>{t("sec4Item2")}</li>
            <li>{t("sec4Item3")}</li>
          </ul>
          <p className="mt-2 leading-relaxed">
            {t("sec4Supabase")}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("sec5Title")}
          </h2>
          <p className="leading-relaxed">
            {t("sec5Body")}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("sec6Title")}
          </h2>
          <p className="mb-2 leading-relaxed">
            {t("sec6Intro")}
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t("sec6Item1")}</li>
            <li>{t("sec6Item2")}</li>
            <li>{t("sec6Item3")}</li>
            <li>{t("sec6Item4")}</li>
          </ul>
          <p className="mt-2 leading-relaxed">
            {t("sec6Closing")}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("sec7Title")}
          </h2>
          <p className="leading-relaxed">
            {t("sec7Body")}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("sec8Title")}
          </h2>
          <p className="leading-relaxed">
            {t("sec8Body")}
            <a
              href="/contact"
              className="text-dq-cyan underline underline-offset-2 hover:text-dq-gold"
            >
              {t("sec8ContactLink")}
            </a>
            {t("sec8Suffix")}
          </p>
        </section>
      </div>
    </div>
  );
}
