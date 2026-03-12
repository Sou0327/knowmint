import { getTranslations } from "next-intl/server";
import McpConfigPanel from "@/components/features/McpConfigPanel";

const STEPS = [
  { icon: "\u2699\ufe0f", key: "setup" },
  { icon: "\ud83d\udd0d", key: "discover" },
  { icon: "\u26a1", key: "autoPay" },
  { icon: "\ud83d\udcda", key: "getKnowledge" },
] as const;

export default async function HowItWorksSection() {
  const [t, tCommon] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
  ]);

  return (
    <section>
      <div className="mb-6 flex items-center gap-4">
        <h2 className="shrink-0 font-display text-xl font-bold text-dq-gold">
          {t("howItWorksTitle")}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-dq-border to-transparent" />
      </div>

      <p className="mb-8 text-sm text-dq-text-sub">{t("howItWorksSubtitle")}</p>

      {/* 4-Step Flow */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.key} className="relative">
            <div className="dq-window-sm h-full p-5">
              {/* Step number */}
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-dq-gold/20 text-xs font-bold text-dq-gold">
                  {i + 1}
                </span>
                <span className="text-lg" aria-hidden="true">
                  {s.icon}
                </span>
              </div>

              <h3 className="mb-2 text-sm font-bold text-dq-gold">
                {t(`howItWorksStep${i + 1}Title`)}
              </h3>
              <p className="text-xs leading-relaxed text-dq-text-sub">
                {t(`howItWorksStep${i + 1}Desc`)}
              </p>
            </div>

            {/* Arrow connector (desktop only, not on last item) */}
            {i < STEPS.length - 1 && (
              <div className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-dq-gold/60 lg:block">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6 2l6 6-6 6V2z" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 3 Access Methods */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {/* MCP */}
        <div className="dq-window-sm p-5">
          <div className="mb-2 text-2xl" aria-hidden="true">🤖</div>
          <h3 className="mb-1 font-display text-sm font-bold text-dq-gold">
            {t("accessMethod1Title")}
          </h3>
          <p className="mb-3 text-xs leading-relaxed text-dq-text-sub">
            {t("accessMethod1Desc")}
          </p>
          <a
            href="#mcp-config-panel"
            className="text-xs text-dq-cyan transition-colors hover:text-dq-gold"
          >
            {t("accessMethod1Link")}
          </a>
        </div>

        {/* CLI */}
        <div className="dq-window-sm p-5">
          <div className="mb-2 text-2xl" aria-hidden="true">⌨️</div>
          <h3 className="mb-1 font-display text-sm font-bold text-dq-gold">
            {t("accessMethod2Title")}
          </h3>
          <p className="mb-3 text-xs leading-relaxed text-dq-text-sub">
            {t("accessMethod2Desc")}
          </p>
          <a
            href="https://github.com/Sou0327/knowmint/tree/main/cli"
            className="text-xs text-dq-cyan transition-colors hover:text-dq-gold"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("accessMethod2Link")}
          </a>
        </div>

        {/* REST API */}
        <div className="dq-window-sm p-5">
          <div className="mb-2 text-2xl" aria-hidden="true">🔌</div>
          <h3 className="mb-1 font-display text-sm font-bold text-dq-gold">
            {t("accessMethod3Title")}
          </h3>
          <p className="mb-3 text-xs leading-relaxed text-dq-text-sub">
            {t("accessMethod3Desc")}
          </p>
          <a
            href="https://github.com/Sou0327/knowmint/tree/main/mcp"
            className="text-xs text-dq-cyan transition-colors hover:text-dq-gold"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("accessMethod3Link")}
          </a>
        </div>
      </div>

      {/* MCP Config — collapsible (Client Component) */}
      <McpConfigPanel
        toggleLabel={t("howItWorksMcpToggle")}
        toggleCloseLabel={t("howItWorksMcpToggleClose")}
        configTitle={t("howItWorksMcpConfigTitle")}
        configDesc={t("howItWorksMcpConfigDesc")}
        copyLabel={tCommon("copy")}
        copiedLabel={tCommon("copied")}
      />
    </section>
  );
}
