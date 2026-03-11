import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("Terms");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: { title: t("ogTitle"), type: "website" },
  };
}

export default async function TermsPage() {
  const t = await getTranslations("Terms");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold font-display text-dq-gold">
        {t("title")}
      </h1>
      <p className="mb-8 text-sm text-dq-text-muted">{t("lastUpdated")}</p>

      <div className="font-legal space-y-8 text-dq-text-sub">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art1Title")}
          </h2>
          <p className="leading-relaxed">{t("art1Body")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art2Title")}
          </h2>
          <p className="leading-relaxed">{t("art2Body")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art3Title")}
          </h2>
          <p className="mb-2 leading-relaxed">{t("art3Intro")}</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t("art3Item1")}</li>
            <li>{t("art3Item2")}</li>
            <li>{t("art3Item3")}</li>
            <li>{t("art3Item4")}</li>
            <li>{t("art3Item5")}</li>
            <li>{t("art3Item6")}</li>
            <li>{t("art3Item7")}</li>
            <li>{t("art3Item8")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art4Title")}
          </h2>
          <p className="mb-2 leading-relaxed">{t("art4Body1")}</p>
          <p className="mb-2 leading-relaxed">{t("art4Body2")}</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t("art4Item1")}</li>
            <li>{t("art4Item2")}</li>
            <li>{t("art4Item3")}</li>
          </ul>
          <p className="mt-2 leading-relaxed">{t("art4Body3")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art5Title")}
          </h2>
          <p className="mb-2 leading-relaxed">{t("art5Intro")}</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t("art5Item1")}</li>
            <li>{t("art5Item2")}</li>
            <li>{t("art5Item3")}</li>
            <li>{t("art5Item4")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art6Title")}
          </h2>
          <p className="leading-relaxed">{t("art6Body")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art7Title")}
          </h2>
          <p className="leading-relaxed">{t("art7Body")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art8Title")}
          </h2>
          <p className="mb-2 leading-relaxed">{t("art8Intro")}</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t("art8Item1")}</li>
            <li>{t("art8Item2")}</li>
            <li>{t("art8Item3")}</li>
            <li>{t("art8Item4")}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art9Title")}
          </h2>
          <p className="leading-relaxed">{t("art9Body")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art10Title")}
          </h2>
          <p className="leading-relaxed">{t("art10Body")}</p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-dq-gold">
            {t("art11Title")}
          </h2>
          <p className="leading-relaxed">{t("art11Body")}</p>
        </section>
      </div>
    </div>
  );
}
