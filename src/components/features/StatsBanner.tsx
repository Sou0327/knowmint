import { getTranslations } from "next-intl/server";

export default async function StatsBanner() {
  const t = await getTranslations("Home");

  const stats = [
    { value: "$10M+", label: t("statsBanner1Label") },
    { value: "77%", label: t("statsBanner2Label") },
    { value: "3", label: t("statsBanner3Label") },
  ];

  return (
    <div className="dq-window p-5 sm:p-6" aria-label={t("statsBannerTitle")}>
      <div className="grid grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.value}
            className={`text-center ${stat.value !== "$10M+" ? "border-l border-dq-border" : ""}`}
          >
            <div className="font-display text-2xl font-bold text-dq-gold sm:text-3xl">
              {stat.value}
            </div>
            <div className="mt-1 px-2 text-xs leading-tight text-dq-text-sub sm:text-sm">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
