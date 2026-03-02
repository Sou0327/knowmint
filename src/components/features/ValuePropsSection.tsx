import { getTranslations } from "next-intl/server";

const PROP_ICONS = ["⚙️", "⚡", "🔐"] as const;

export default async function ValuePropsSection() {
  const t = await getTranslations("Home");

  const props = [
    { icon: PROP_ICONS[0], title: t("valueProp1Title"), desc: t("valueProp1Desc") },
    { icon: PROP_ICONS[1], title: t("valueProp2Title"), desc: t("valueProp2Desc") },
    { icon: PROP_ICONS[2], title: t("valueProp3Title"), desc: t("valueProp3Desc") },
  ];

  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <h2 className="shrink-0 font-display text-xl font-bold text-dq-gold">
          {t("valuePropTitle")}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-dq-border to-transparent" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {props.map((prop) => (
          <div key={prop.icon} className="dq-window-sm dq-window-hover p-6">
            <span className="mb-4 block text-3xl" aria-hidden="true">
              {prop.icon}
            </span>
            <h3 className="mb-2 font-display text-base font-bold text-dq-gold">{prop.title}</h3>
            <p className="text-sm leading-relaxed text-dq-text-sub">{prop.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
