import { getTranslations } from "next-intl/server";

export default async function StatsBanner() {
  const t = await getTranslations("Home");

  const stats = [
    { value: "$10M+", sup: "1", label: t("statsBanner1Label") },
    { value: "77%", sup: "2", label: t("statsBanner2Label") },
    { value: "3", sup: null, label: t("statsBanner3Label") },
  ];

  return (
    <div className="dq-window p-5 sm:p-6" aria-label={t("statsBannerTitle")}>
      <div className="grid grid-cols-3">
        {stats.map((stat, i) => (
          <div
            key={stat.value}
            className={`text-center ${i > 0 ? "border-l border-dq-border" : ""}`}
          >
            <div className="font-display text-2xl font-bold text-dq-gold sm:text-3xl">
              {stat.value}
              {stat.sup && <sup className="text-xs text-dq-text-muted">{stat.sup}</sup>}
            </div>
            <div className="mt-1 px-2 text-xs leading-tight text-dq-text-sub sm:text-sm">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-dq-border pt-2 text-center">
        <small className="text-[10px] leading-tight text-dq-text-muted">
          <sup>1</sup>{" "}
          <a href={t("statsCitation1Url")} target="_blank" rel="noopener noreferrer" className="underline hover:text-dq-cyan">
            {t("statsCitation1")}
          </a>{" "}
          <sup>2</sup>{" "}
          <a href={t("statsCitation2Url")} target="_blank" rel="noopener noreferrer" className="underline hover:text-dq-cyan">
            {t("statsCitation2")}
          </a>
        </small>
      </div>
    </div>
  );
}
