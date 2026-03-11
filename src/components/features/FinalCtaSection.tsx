import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function FinalCtaSection() {
  const t = await getTranslations("Home");

  return (
    <section>
      <div className="dq-window p-6 sm:p-8">
        <div className="grid gap-8 sm:grid-cols-2">
          {/* Seller CTA */}
          <div>
            <h3 className="mb-3 font-display text-lg font-bold text-dq-gold sm:text-xl">
              {t("finalCtaSellerTitle")}
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-dq-text-sub">
              {t("finalCtaSellerDesc")}
            </p>
            <Link
              href="/list"
              className="inline-block rounded-sm bg-dq-gold px-7 py-3 text-sm font-bold text-dq-bg shadow-[0_0_20px_rgba(245,197,66,0.2)] transition-all hover:brightness-110 hover:shadow-[0_0_30px_rgba(245,197,66,0.3)]"
            >
              {t("finalCtaSellerBtn")}
            </Link>
          </div>

          {/* AI Agent CTA — top border on mobile acts as divider, left border on desktop */}
          <div className="border-t border-dq-border pt-8 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <h3 className="mb-3 font-display text-lg font-bold text-dq-cyan sm:text-xl">
              {t("finalCtaAgentTitle")}
            </h3>
            <p className="mb-6 text-sm leading-relaxed text-dq-text-sub">
              {t("finalCtaAgentDesc")}
            </p>
            <Link
              href="/dashboard/api-keys"
              className="inline-block rounded-sm border-2 border-dq-cyan/60 px-7 py-3 text-sm font-semibold text-dq-cyan transition-all hover:border-dq-cyan hover:bg-dq-cyan/5"
            >
              {t("finalCtaAgentBtn")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
